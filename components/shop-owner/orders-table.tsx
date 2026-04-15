"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, formatFileSize, statusClassName, statusLabel } from "@/lib/utils/format";
import type { OrderStatus, OrderWithFiles } from "@/types";

export function OrdersTable({ orders }: { orders: OrderWithFiles[] }) {
  const router = useRouter();
  const [updatingOrderId, setUpdatingOrderId] = useState("");

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

      router.refresh();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Unable to update status.",
      );
    } finally {
      setUpdatingOrderId("");
    }
  }

  if (orders.length === 0) {
    return (
      <div className="panel p-8 text-center text-sm text-slate-600">
        No print requests yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
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
              <p className="mt-2 text-sm text-slate-500">
                Received {formatDate(order.createdAt)}
              </p>
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
              <label className="label" htmlFor={`status-${order.id}`}>
                Update status
              </label>
              <select
                id={`status-${order.id}`}
                className="input"
                defaultValue={order.status}
                disabled={updatingOrderId === order.id}
                onChange={(event) =>
                  handleStatusChange(order.id, event.target.value as OrderStatus)
                }
              >
                <option value="pending">Pending</option>
                <option value="downloaded">Downloaded</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
