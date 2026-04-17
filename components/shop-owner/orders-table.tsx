"use client";

import { useEffect, useState } from "react";
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

export function OrdersTable({
  orders,
}: {
  orders: OrderWithFiles[];
}) {
  const router = useRouter();
  const [localOrders, setLocalOrders] = useState<OrderWithFiles[]>(orders);
  const [updatingOrderId, setUpdatingOrderId] = useState("");
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
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-slate-900">
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
              {order.paymentStatus === "paid" ? (
                <p className="mt-2 text-sm font-semibold text-emerald-700">
                  Paid by customer
                </p>
              ) : null}
            </div>

            <div className="grid gap-3 text-sm text-slate-600 md:text-right">
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
                      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="text-sm text-slate-600">
                        <p className="font-medium text-slate-900">
                          {file.originalFileName}
                        </p>
                        <p>{formatFileSize(file.size)}</p>
                      </div>
                      <a
                        href={`/api/orders/files/${file.id}/download`}
                        className="btn-secondary"
                      >
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {order.status === "completed" ? (
                <>
                  <p className="label">Completed</p>
                  {order.paymentStatus === "paid" ? (
                    <p className="text-sm text-slate-600">
                      Payment is complete. The final amount is locked.
                    </p>
                  ) : (
                    <>
                      <p className="text-sm text-slate-600">
                        Customer can see this amount. You can still correct it before payment.
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
