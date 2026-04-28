import Link from "next/link";
import { PayOrderButton } from "@/components/customer/pay-order-button";
import {
  canShopReceiveOnlinePayments,
  getShopPaymentUnavailableMessage,
} from "@/lib/payments/shop-readiness";
import {
  customerStatusLabel,
  formatCurrency,
  formatDate,
  formatTrackingId,
  statusClassName,
} from "@/lib/utils/format";
import type { OrderWithFiles, Shop, UserProfile } from "@/types";

export function CustomerOrdersList({
  orders,
  shopsById,
  profile,
}: {
  orders: OrderWithFiles[];
  shopsById: Record<string, Shop>;
  profile: UserProfile;
}) {
  if (orders.length === 0) {
    return (
      <div className="panel p-8 text-center text-sm text-slate-600">
        No orders yet. Pick a shop and send your first print request.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const shop = shopsById[order.shopId];
        const canAcceptOnlinePayment = canShopReceiveOnlinePayments(shop);
        const payableAmount =
          order.totalAmountPaise !== null && order.totalAmountPaise !== undefined
            ? Number(order.totalAmountPaise) / 100
            : null;
        const shouldShowPaymentAction =
          order.status === "pending" &&
          payableAmount !== null &&
          (order.paymentStatus === "ready_to_pay" ||
            order.paymentStatus === "payment_failed" ||
            order.paymentStatus === "unpaid") &&
          canAcceptOnlinePayment;

        return (
          <article key={order.id} className="panel p-4 sm:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="eyebrow">Order</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h3 className="text-xl font-semibold tracking-[-0.03em] text-slate-900">
                    {shop?.shopName || "Shop"}
                  </h3>
                  <span className={`badge ${statusClassName(order.status)}`}>
                    {customerStatusLabel(order.status, order.paymentStatus)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Sent {formatDate(order.createdAt)}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Tracking ID:{" "}
                  <span className="font-semibold text-slate-900">
                    {formatTrackingId(order.shopId, order.trackingCode, order.id)}
                  </span>
                </p>
                {shop ? (
                  <div className="mt-3 flex flex-wrap gap-3">
                    <a href={`tel:${shop.phone}`} className="btn-secondary">
                      Call
                    </a>
                    {shop.googleMapsUrl ? (
                      <a
                        href={shop.googleMapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary"
                      >
                        Location
                      </a>
                    ) : null}
                  </div>
                ) : null}
                <p className="mt-3 text-sm text-slate-600">
                  {order.printType === "color" ? "Color" : "Black & white"} |{" "}
                  {order.sideType === "double_side" ? "Double side" : "Single side"} |{" "}
                  {order.pageCount || 0} pages | {order.copies} copies
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {order.files.map((file) => (
                    <span
                      key={file.id}
                      className="rounded-full bg-[#f5e5d7] px-3 py-1 text-xs font-semibold text-[#6a4d3a]"
                    >
                      {file.originalFileName}
                    </span>
                  ))}
                </div>
              </div>

              <div className="w-full rounded-[24px] bg-[rgba(255,247,239,0.95)] p-4 text-left md:min-w-56 md:w-auto md:text-right">
                {order.printCostPaise !== null && order.printCostPaise !== undefined ? (
                  <>
                    <p className="text-sm text-slate-500">Shop quote</p>
                    <p className="mt-2 text-xl font-semibold text-slate-900">
                      {formatCurrency(order.printCostPaise / 100)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">Awaiting shop quote</p>
                )}
                {shouldShowPaymentAction ? (
                  <PayOrderButton
                    orderId={order.id}
                    amount={payableAmount ?? 0}
                    customerName={profile.name}
                    email={profile.email}
                    phone={profile.phone}
                  />
                ) : null}
                {order.platformFeePaise !== null &&
                order.platformFeePaise !== undefined &&
                order.platformFeePaise > 0 ? (
                  <p className="mt-2 text-sm text-slate-500">
                    Platform fee: {formatCurrency(order.platformFeePaise / 100)}
                  </p>
                ) : null}
                {order.totalAmountPaise !== null && order.totalAmountPaise !== undefined ? (
                  <p className="mt-2 text-sm text-slate-500">
                    Total: {formatCurrency(order.totalAmountPaise / 100)}
                  </p>
                ) : null}
                {!canAcceptOnlinePayment &&
                order.status === "pending" &&
                payableAmount !== null &&
                (order.paymentStatus === "ready_to_pay" ||
                  order.paymentStatus === "payment_failed" ||
                  order.paymentStatus === "unpaid") ? (
                  <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                    {getShopPaymentUnavailableMessage(shop)}
                  </div>
                ) : null}
                {order.paymentStatus === "quote_pending" ? (
                  <div className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
                    The shop is reviewing your files and has not set the final payment amount yet.
                  </div>
                ) : null}
                {order.paymentStatus === "payment_failed" ? (
                  <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                    Payment failed. You can retry checkout with the same server-created order.
                  </div>
                ) : null}
                {order.paymentStatus === "paid" ? (
                  <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                    Payment received
                  </div>
                ) : null}
                {order.paymentStatus === "refund_pending" ? (
                  <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                    Refund in progress
                  </div>
                ) : null}
                {order.paymentStatus === "refunded" ? (
                  <div className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
                    Refunded
                  </div>
                ) : null}
                {order.paymentStatus === "refund_failed" ? (
                  <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                    Refund failed. Support review is required.
                  </div>
                ) : null}
                {shop ? (
                  <Link
                    href={`/customer/shop/${shop.id}`}
                    className="btn-secondary mt-4 w-full md:w-auto"
                  >
                    Order again
                  </Link>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
