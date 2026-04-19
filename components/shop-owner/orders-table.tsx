"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  formatCurrency,
  formatDate,
  formatFileSize,
  formatTrackingId,
  statusClassName,
  statusLabel,
} from "@/lib/utils/format";
import type { OrderStatus, OrderWithFiles } from "@/types";

const DOWNLOADED_FILES_DB = "snapcopy-downloaded-files";
const DOWNLOADED_FILES_STORE = "files";

function openDownloadedFilesDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DOWNLOADED_FILES_DB, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DOWNLOADED_FILES_STORE)) {
        database.createObjectStore(DOWNLOADED_FILES_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open local file store."));
  });
}

async function saveDownloadedFile(fileId: string, blob: Blob) {
  const database = await openDownloadedFilesDb();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(DOWNLOADED_FILES_STORE, "readwrite");
    const store = transaction.objectStore(DOWNLOADED_FILES_STORE);
    const request = store.put(blob, fileId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Unable to save downloaded file."));
  });

  database.close();
}

async function getDownloadedFile(fileId: string) {
  const database = await openDownloadedFilesDb();

  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const transaction = database.transaction(DOWNLOADED_FILES_STORE, "readonly");
    const store = transaction.objectStore(DOWNLOADED_FILES_STORE);
    const request = store.get(fileId);

    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Unable to read downloaded file."));
  });

  database.close();
  return blob;
}

export function OrdersTable({
  orders,
}: {
  orders: OrderWithFiles[];
}) {
  const router = useRouter();
  const fileObjectUrlsRef = useRef<Record<string, string>>({});
  const [localOrders, setLocalOrders] = useState<OrderWithFiles[]>(orders);
  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const [downloadingFileId, setDownloadingFileId] = useState("");
  const [downloadedFileUrls, setDownloadedFileUrls] = useState<Record<string, string>>({});
  const [completionAmounts, setCompletionAmounts] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        orders.map((order) => [
          order.id,
          String(order.finalAmount ?? ""),
        ]),
      ),
  );

  useEffect(() => {
    setLocalOrders(orders);
    setCompletionAmounts(
      Object.fromEntries(
        orders.map((order) => [order.id, String(order.finalAmount ?? "")]),
      ),
    );
  }, [orders]);

  useEffect(() => {
    const objectUrls = fileObjectUrlsRef.current;

    return () => {
      Object.values(objectUrls).forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, []);

  async function handleStatusChange(orderId: string, status: OrderStatus) {
    setUpdatingOrderId(orderId);

    try {
      const finalAmount = Number(completionAmounts[orderId]);
      if (status === "completed" && (Number.isNaN(finalAmount) || finalAmount < 0)) {
        throw new Error("Enter a valid final amount before completing the order.");
      }

      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, finalAmount }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || "Unable to update status.");
      }

      const payload = await response.json();
      if (payload.order) {
        setLocalOrders((current) =>
          current.map((order) =>
            order.id === orderId ? { ...order, ...payload.order } : order,
          ),
        );
      }
      router.refresh();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Unable to update status.",
      );
    } finally {
      setUpdatingOrderId("");
    }
  }

  function handleFileDownloaded(orderId: string, fileId: string) {
    const downloadedAt = new Date().toISOString();

    setLocalOrders((current) =>
      current.map((order) =>
        order.id !== orderId
          ? order
          : {
              ...order,
              files: order.files.map((file) =>
                file.id !== fileId
                  ? file
                  : {
                      ...file,
                      downloadedAt,
                    },
              ),
            },
      ),
    );
  }

  async function handleFileDownload(
    orderId: string,
    fileId: string,
    fileName: string,
  ) {
    setDownloadingFileId(fileId);

    try {
      const response = await fetch(`/api/orders/files/${fileId}/download`, {
        method: "GET",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Unable to download file.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const previousUrl = fileObjectUrlsRef.current[fileId];

      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }

      fileObjectUrlsRef.current[fileId] = objectUrl;
      setDownloadedFileUrls((current) => ({
        ...current,
        [fileId]: objectUrl,
      }));
      await saveDownloadedFile(fileId, blob);
      handleFileDownloaded(orderId, fileId);

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();

    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to download file.");
    } finally {
      setDownloadingFileId("");
    }
  }

  async function handleOpenDownloadedFile(fileId: string) {
    const objectUrl = downloadedFileUrls[fileId];

    if (objectUrl) {
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      return;
    }

    try {
      const blob = await getDownloadedFile(fileId);
      if (!blob) {
        window.alert("This file is not available locally. Download it again on this device.");
        return;
      }

      const localObjectUrl = URL.createObjectURL(blob);
      const previousUrl = fileObjectUrlsRef.current[fileId];

      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }

      fileObjectUrlsRef.current[fileId] = localObjectUrl;
      setDownloadedFileUrls((current) => ({
        ...current,
        [fileId]: localObjectUrl,
      }));

      window.open(localObjectUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to open downloaded file.");
    }
  }

  if (localOrders.length === 0) {
    return (
      <div className="panel p-8 text-center text-sm text-slate-600">
        No print requests yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {localOrders.map((order) => (
        <article key={order.id} className="panel overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-[#eadfd3] px-5 py-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="eyebrow">Incoming order</p>
              <div className="mt-2 flex items-center gap-3">
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-900">
                  {order.customerName}
                </h2>
                <span className={`badge ${statusClassName(order.status)}`}>
                  {statusLabel(order.status)}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {order.customerPhone}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Tracking ID:{" "}
                <span className="font-semibold text-slate-900">
                  {formatTrackingId(order.shopId, order.trackingCode, order.id)}
                </span>
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Received {formatDate(order.createdAt)}
              </p>
              {order.finalAmount !== null && order.finalAmount !== undefined ? (
                <p className="mt-2 text-sm font-semibold text-emerald-700">
                  Final amount: {formatCurrency(order.finalAmount)}
                </p>
              ) : null}
              {order.platformTransactionFeePaise !== null &&
              order.platformTransactionFeePaise !== undefined ? (
                <p className="mt-2 text-sm text-slate-500">
                  Platform transaction fee: {formatCurrency(order.platformTransactionFeePaise / 100)}
                </p>
              ) : order.platformCommissionPaise !== null &&
                order.platformCommissionPaise !== undefined ? (
                <p className="mt-2 text-sm text-slate-500">
                  Platform transaction fee: {formatCurrency(order.platformCommissionPaise / 100)}
                </p>
              ) : null}
              {order.estimatedFeePaise !== null &&
              order.estimatedFeePaise !== undefined ? (
                <p className="mt-2 text-sm text-slate-500">
                  Payment processing fee: {formatCurrency(order.estimatedFeePaise / 100)}
                </p>
              ) : null}
              {order.estimatedTaxPaise !== null &&
              order.estimatedTaxPaise !== undefined ? (
                <p className="mt-2 text-sm text-slate-500">
                  GST on fee: {formatCurrency(order.estimatedTaxPaise / 100)}
                </p>
              ) : null}
              {order.transferableAmountPaise !== null &&
              order.transferableAmountPaise !== undefined ? (
                <p className="mt-2 text-sm font-semibold text-sky-700">
                  Shop payout: {formatCurrency(order.transferableAmountPaise / 100)}
                </p>
              ) : null}
              {order.transferStatus ? (
                <p className="mt-2 text-sm text-slate-500">
                  Transfer status: {order.transferStatus}
                </p>
              ) : null}
              {order.paymentStatus === "paid" ? (
                <p className="mt-2 text-sm font-semibold text-emerald-700">
                  Paid by customer
                </p>
              ) : null}
            </div>

            <div className="grid gap-3 rounded-[24px] bg-[rgba(255,247,239,0.95)] p-4 text-sm text-slate-600 md:text-right">
              <p>Print: {order.printType === "color" ? "Color" : "Black & white"}</p>
              <p>
                Sides:{" "}
                {order.sideType === "double_side" ? "Double side" : "Single side"}
              </p>
              <p>Copies: {order.copies}</p>
            </div>
          </div>

          <div className="grid gap-5 px-5 py-5 lg:grid-cols-[1.3fr_0.7fr]">
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-900">Notes</p>
              <p className="text-sm leading-6 text-slate-600">
                {order.notes || "No notes provided."}
              </p>

              <div className="mt-5">
                <p className="mb-3 text-sm font-semibold text-slate-900">Files</p>
                <div className="space-y-3">
                  {order.files.map((file) => (
                    <div
                      key={file.id}
                      className="flex flex-col gap-3 rounded-[22px] border border-[#eadfd3] bg-[rgba(255,248,241,0.82)] p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="text-sm text-slate-600">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-900">
                            {file.originalFileName}
                          </p>
                          {file.downloadedAt ? (
                            <span className="badge status-downloaded">Downloaded</span>
                          ) : null}
                        </div>
                        <p>{formatFileSize(file.size)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={downloadingFileId === file.id}
                          suppressHydrationWarning
                          onClick={() =>
                            void handleFileDownload(
                              order.id,
                              file.id,
                              file.originalFileName,
                            )
                          }
                          className="btn-secondary"
                        >
                          {downloadingFileId === file.id ? "Downloading..." : "Download"}
                        </button>
                        {file.downloadedAt ? (
                          <button
                            type="button"
                            suppressHydrationWarning
                            onClick={() => void handleOpenDownloadedFile(file.id)}
                            className="btn-secondary"
                          >
                            Open
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-[#eadfd3] bg-[rgba(255,248,241,0.88)] p-4">
              {order.status === "completed" ? (
                <>
                  <p className="label">Completed</p>
                  {order.paymentStatus === "paid" ? (
                      <p className="text-sm text-slate-600">
                        Payment is complete. The platform now calculates the flat platform fee, gateway cost, and payout before creating the Route transfer.
                      </p>
                  ) : (
                    <>
                      <p className="text-sm text-slate-600">
                        Customer can see this amount. After payment, the server calculates the flat platform fee, processing cost, and shop payout.
                      </p>
                      <label className="label mt-4" htmlFor={`amount-${order.id}`}>
                        Correct final amount
                      </label>
                      <input
                        id={`amount-${order.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        className="input"
                        value={completionAmounts[order.id] ?? ""}
                        suppressHydrationWarning
                        onChange={(event) =>
                          setCompletionAmounts((current) => ({
                            ...current,
                            [order.id]: event.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        disabled={updatingOrderId === order.id}
                        suppressHydrationWarning
                        onClick={() => void handleStatusChange(order.id, "completed")}
                        className="btn-secondary mt-4 w-full"
                      >
                        {updatingOrderId === order.id ? "Saving..." : "Correct price"}
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <label className="label" htmlFor={`amount-${order.id}`}>
                    Final amount
                  </label>
                  <input
                    id={`amount-${order.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    className="input"
                    value={completionAmounts[order.id] ?? ""}
                    suppressHydrationWarning
                    onChange={(event) =>
                      setCompletionAmounts((current) => ({
                        ...current,
                        [order.id]: event.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    disabled={updatingOrderId === order.id}
                    suppressHydrationWarning
                    onClick={() => void handleStatusChange(order.id, "completed")}
                    className="btn-primary mt-4 w-full"
                  >
                    {updatingOrderId === order.id ? "Saving..." : "Printed"}
                  </button>
                </>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
