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

function getNextStatusOptions(order: OrderWithFiles): OrderStatus[] {
  if (order.paymentStatus !== "paid") {
    return [];
  }

  if (order.status === "confirmed") {
    return ["in_progress", "ready_for_pickup", "completed"];
  }

  if (order.status === "in_progress") {
    return ["ready_for_pickup", "completed"];
  }

  if (order.status === "ready_for_pickup") {
    return ["completed"];
  }

  return [];
}

function isZeroPricedOrder(order: OrderWithFiles) {
  return (
    order.printCostPaise !== null &&
    order.printCostPaise !== undefined &&
    (Number(order.printCostPaise) <= 0 ||
      (order.totalAmountPaise !== null &&
        order.totalAmountPaise !== undefined &&
        Number(order.totalAmountPaise) <= 0))
  );
}

export function OrdersTable({ orders }: { orders: OrderWithFiles[] }) {
  const router = useRouter();
  const fileObjectUrlsRef = useRef<Record<string, string>>({});
  const [localOrders, setLocalOrders] = useState<OrderWithFiles[]>(orders);
  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const [savingQuoteOrderId, setSavingQuoteOrderId] = useState("");
  const [downloadingFileId, setDownloadingFileId] = useState("");
  const [downloadedFileUrls, setDownloadedFileUrls] = useState<Record<string, string>>({});
  const [quoteDrafts, setQuoteDrafts] = useState<Record<string, string>>({});
  const [quoteErrors, setQuoteErrors] = useState<Record<string, string>>({});
  const [quoteMessages, setQuoteMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    setLocalOrders(orders);
    setQuoteDrafts(
      Object.fromEntries(
        orders.map((order) => [
          order.id,
          order.printCostPaise !== null && order.printCostPaise !== undefined
            ? (order.printCostPaise / 100).toFixed(2)
            : "",
        ]),
      ),
    );
  }, [orders]);

  useEffect(() => {
    const objectUrls = fileObjectUrlsRef.current;
    return () => {
      Object.values(objectUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  async function handleStatusChange(orderId: string, status: OrderStatus) {
    setUpdatingOrderId(orderId);

    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || "Unable to update status.");
      }

      const payload = await response.json();
      if (payload.order) {
        setLocalOrders((current) =>
          current.map((order) => (order.id === orderId ? { ...order, ...payload.order } : order)),
        );
      }
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to update status.");
    } finally {
      setUpdatingOrderId("");
    }
  }

  async function handleQuoteSave(orderId: string) {
    setSavingQuoteOrderId(orderId);
    setQuoteErrors((current) => ({ ...current, [orderId]: "" }));
    setQuoteMessages((current) => ({ ...current, [orderId]: "" }));

    try {
      const response = await fetch(`/api/shop-owner/orders/${orderId}/quote`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountRupees: quoteDrafts[orderId],
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to save payment amount.");
      }

      if (payload.order) {
        setLocalOrders((current) =>
          current.map((order) => (order.id === orderId ? { ...order, ...payload.order } : order)),
        );
        setQuoteDrafts((current) => ({
          ...current,
          [orderId]:
            payload.order.printCostPaise !== null && payload.order.printCostPaise !== undefined
              ? (Number(payload.order.printCostPaise) / 100).toFixed(2)
              : current[orderId] || "",
        }));
      }

      setQuoteMessages((current) => ({
        ...current,
        [orderId]: payload.message || "Payment amount saved.",
      }));
      router.refresh();
    } catch (error) {
      setQuoteErrors((current) => ({
        ...current,
        [orderId]: error instanceof Error ? error.message : "Unable to save payment amount.",
      }));
    } finally {
      setSavingQuoteOrderId("");
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
                file.id !== fileId ? file : { ...file, downloadedAt },
              ),
            },
      ),
    );
  }

  async function handleFileDownload(orderId: string, fileId: string, fileName: string) {
    setDownloadingFileId(fileId);

    try {
      const response = await fetch(`/api/orders/files/${fileId}/download`, { method: "GET" });

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
      setDownloadedFileUrls((current) => ({ ...current, [fileId]: objectUrl }));
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
      setDownloadedFileUrls((current) => ({ ...current, [fileId]: localObjectUrl }));
      window.open(localObjectUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to open downloaded file.");
    }
  }

  if (localOrders.length === 0) {
    return <div className="panel p-8 text-center text-sm text-slate-600">No print requests yet.</div>;
  }

  return (
    <div className="space-y-4">
      {localOrders.map((order) => {
        const nextStatuses = getNextStatusOptions(order);
        const canEditQuote =
          order.paymentStatus !== "paid" &&
          order.paymentStatus !== "refund_pending" &&
          order.paymentStatus !== "refunded" &&
          order.paymentStatus !== "refund_failed";
        const quoteDraft = quoteDrafts[order.id] ?? "";

        return (
          <article key={order.id} className="panel overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-[#eadfd3] px-4 py-4 sm:px-5 sm:py-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="eyebrow">Incoming order</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-900">
                    {order.customerName}
                  </h2>
                  <span className={`badge ${statusClassName(order.status)}`}>
                    {statusLabel(order.status, order.paymentStatus)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{order.customerPhone}</p>
                <p className="mt-2 text-sm text-slate-600">
                  Tracking ID:{" "}
                  <span className="font-semibold text-slate-900">
                    {formatTrackingId(order.shopId, order.trackingCode, order.id)}
                  </span>
                </p>
                <p className="mt-2 text-sm text-slate-500">Received {formatDate(order.createdAt)}</p>
                {order.paymentStatus === "paid" ? (
                  <p className="mt-2 text-sm font-semibold text-emerald-700">Payment verified</p>
                ) : order.paymentStatus === "quote_pending" ? (
                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    Waiting for you to set the final amount
                  </p>
                ) : order.paymentStatus === "ready_to_pay" ? (
                  <p className="mt-2 text-sm font-semibold text-sky-700">
                    Amount saved. Customer can pay now.
                  </p>
                ) : order.paymentStatus === "payment_failed" ? (
                  <p className="mt-2 text-sm font-semibold text-rose-700">Payment failed</p>
                ) : (
                  <p className="mt-2 text-sm font-semibold text-amber-900">Awaiting payment</p>
                )}
              </div>

              <div className="grid gap-2 rounded-[24px] bg-[rgba(255,247,239,0.95)] p-4 text-sm text-slate-600 md:min-w-72 md:text-right">
                <p>{order.printType === "color" ? "Color" : "Black & white"}</p>
                <p>{order.sideType === "double_side" ? "Double side" : "Single side"}</p>
                <p>{order.pageCount || 0} pages</p>
                <p>{order.copies} copies</p>
                {order.transferableAmountPaise !== null && order.transferableAmountPaise !== undefined ? (
                  <p className="font-semibold text-slate-900">
                    You receive: {formatCurrency(order.transferableAmountPaise / 100)}
                  </p>
                ) : order.shopEarningPaise !== null && order.shopEarningPaise !== undefined ? (
                  <p className="font-semibold text-slate-900">
                    You receive: {formatCurrency(order.shopEarningPaise / 100)}
                  </p>
                ) : (
                  <p className="font-semibold text-slate-900">Awaiting quote</p>
                )}
                {order.transferStatus && order.transferStatus !== "not_created" ? (
                  <p>Route transfer: {order.transferStatus}</p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-5 px-4 py-4 sm:px-5 sm:py-5 lg:grid-cols-[1.3fr_0.7fr]">
              <div>
                {isZeroPricedOrder(order) ? (
                  <div className="mb-5 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                    This order was created before valid pricing was set. Ask customer to place a new order.
                  </div>
                ) : null}
                <p className="mb-2 text-sm font-semibold text-slate-900">Notes</p>
                <p className="text-sm leading-6 text-slate-600">{order.notes || "No notes provided."}</p>

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
                            <p className="font-medium text-slate-900">{file.originalFileName}</p>
                            {file.downloadedAt ? <span className="badge status-downloaded">Downloaded</span> : null}
                          </div>
                          <p>{formatFileSize(file.size)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={downloadingFileId === file.id}
                            suppressHydrationWarning
                            onClick={() => void handleFileDownload(order.id, file.id, file.originalFileName)}
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
                <p className="label">Customer Payment</p>
                <p className="mt-3 text-sm text-slate-600">
                  Review the files and set the final amount for this specific order. Customers can
                  pay only after you save it.
                </p>
                {canEditQuote ? (
                  <>
                    <div className="mt-4">
                      <label className="label" htmlFor={`quote-${order.id}`}>
                        Set payment amount
                      </label>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="rounded-full bg-[#f5decc] px-3 py-2 text-sm font-semibold text-[#9c4c20]">
                          Rs.
                        </span>
                        <input
                          id={`quote-${order.id}`}
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={quoteDraft}
                          onChange={(event) =>
                            setQuoteDrafts((current) => ({
                              ...current,
                              [order.id]: event.target.value,
                            }))
                          }
                          className="input"
                        />
                      </div>
                    </div>
                    {quoteErrors[order.id] ? (
                      <p className="mt-3 text-sm text-rose-700">{quoteErrors[order.id]}</p>
                    ) : null}
                    {quoteMessages[order.id] ? (
                      <p className="mt-3 text-sm text-emerald-700">{quoteMessages[order.id]}</p>
                    ) : null}
                    <button
                      type="button"
                      disabled={savingQuoteOrderId === order.id}
                      suppressHydrationWarning
                      onClick={() => void handleQuoteSave(order.id)}
                      className="btn-primary mt-4 w-full"
                    >
                      {savingQuoteOrderId === order.id ? "Saving..." : "Set payment amount"}
                    </button>
                  </>
                ) : (
                  <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                    Payment amount is locked after successful payment.
                  </div>
                )}

                <div className="mt-6 border-t border-[#eadfd3] pt-4">
                  <p className="label">Fulfilment</p>
                  <p className="mt-3 text-sm text-slate-600">
                    Use these controls only after payment is verified.
                  </p>
                  {nextStatuses.length === 0 ? (
                    <div className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
                      {order.paymentStatus === "paid"
                        ? "This order is already complete."
                        : "Fulfilment unlocks after payment is verified."}
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {nextStatuses.map((status) => (
                        <button
                          key={status}
                          type="button"
                          disabled={updatingOrderId === order.id}
                          suppressHydrationWarning
                          onClick={() => void handleStatusChange(order.id, status)}
                          className="btn-primary w-full"
                        >
                          {updatingOrderId === order.id
                            ? "Saving..."
                            : `Mark ${statusLabel(status, order.paymentStatus)}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
