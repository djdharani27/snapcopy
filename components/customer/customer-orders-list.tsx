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
import type { OrderStatus, OrderWithFiles, PaymentStatus, Shop, UserProfile } from "@/types";

function getJourneySteps(status: OrderStatus, paymentStatus?: PaymentStatus | null) {
  const ordered =
    paymentStatus === "paid" ||
    status === "confirmed" ||
    status === "in_progress" ||
    status === "ready_for_pickup" ||
    status === "completed";
  const inProgress =
    status === "in_progress" || status === "ready_for_pickup" || status === "completed";
  const readyForPickup = status === "ready_for_pickup" || status === "completed";
  const activeIndex = !ordered ? 0 : !inProgress ? 1 : !readyForPickup ? 2 : 2;

  return [
    { label: "Ordered", complete: ordered, active: activeIndex === 0 },
    { label: "Order in progress", complete: inProgress, active: activeIndex === 1 },
    { label: "Ready for pickup", complete: readyForPickup, active: activeIndex === 2 },
  ];
}

function getStatusMessage(status: OrderStatus, paymentStatus?: PaymentStatus | null) {
  if (status === "completed") return "Completed and picked up.";
  if (status === "ready_for_pickup") return "Ready at the shop for pickup.";
  if (status === "in_progress") return "The shop has started printing your files.";
  if (status === "confirmed" || paymentStatus === "paid") {
    return "Payment confirmed. The shop will move this into printing.";
  }
  if (paymentStatus === "ready_to_pay") {
    return "The shop has set the final amount. You can pay now.";
  }
  if (paymentStatus === "payment_failed") {
    return "The previous payment did not go through. Retry checkout from this card.";
  }
  if (paymentStatus === "quote_pending") {
    return "The shop is checking the uploaded file and preparing the final quote.";
  }
  if (paymentStatus === "refund_pending") {
    return "Refund initiated. The payment partner is still processing it.";
  }
  if (paymentStatus === "refunded") {
    return "The refund has been completed.";
  }
  if (paymentStatus === "refund_failed") {
    return "The refund failed and needs support review.";
  }
  return "Waiting for the next update from the shop.";
}

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
      <div className="panel p-10 text-center">
        <p className="eyebrow">No active orders</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-900">
          Nothing to track yet.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
          Start from a print category, upload a file, and your live order journey will show up
          here.
        </p>
        <div className="mt-5">
          <Link href="/customer/shops" className="btn-primary">
            Browse print options
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
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
        const journeySteps = getJourneySteps(order.status, order.paymentStatus);

        return (
          <article key={order.id} className="panel-strong overflow-hidden p-5 sm:p-6">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`badge ${statusClassName(order.status)}`}>
                      {customerStatusLabel(order.status, order.paymentStatus)}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8e7b6e]">
                      {formatDate(order.createdAt)}
                    </span>
                  </div>
                  <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-900">
                    {shop?.shopName || "Print shop"}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Tracking ID{" "}
                    <span className="font-semibold text-slate-900">
                      {formatTrackingId(order.shopId, order.trackingCode, order.id)}
                    </span>
                  </p>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                    {getStatusMessage(order.status, order.paymentStatus)}
                  </p>
                </div>

                <div className="w-full rounded-[28px] bg-[rgba(255,247,239,0.95)] p-4 lg:max-w-[280px]">
                  {order.printCostPaise !== null && order.printCostPaise !== undefined ? (
                    <>
                      <p className="text-sm text-slate-500">Final quote</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                        {formatCurrency(order.printCostPaise / 100)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-slate-500">Final quote</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">Awaiting shop update</p>
                    </>
                  )}

                  {order.totalAmountPaise !== null && order.totalAmountPaise !== undefined ? (
                    <p className="mt-2 text-sm text-slate-500">
                      Total payable: {formatCurrency(order.totalAmountPaise / 100)}
                    </p>
                  ) : null}

                  {order.platformFeePaise !== null &&
                  order.platformFeePaise !== undefined &&
                  order.platformFeePaise > 0 ? (
                    <p className="mt-1 text-sm text-slate-500">
                      Platform fee: {formatCurrency(order.platformFeePaise / 100)}
                    </p>
                  ) : null}

                  {shouldShowPaymentAction ? (
                    <PayOrderButton
                      orderId={order.id}
                      amount={payableAmount ?? 0}
                      customerName={profile.name}
                      email={profile.email}
                      phone={profile.phone}
                    />
                  ) : null}
                </div>
              </div>

              <div className="rounded-[28px] border border-[#eadfd3] bg-[rgba(255,250,245,0.92)] px-4 py-5 sm:px-5">
                <div className="flex items-center gap-2 overflow-x-auto">
                  {journeySteps.map((step, index) => (
                    <div key={step.label} className="flex min-w-0 flex-1 items-center gap-2">
                      <div className="flex min-w-[110px] flex-col items-center text-center sm:min-w-[140px]">
                        <div
                          className={
                            step.complete
                              ? `tracker-node tracker-node-complete ${
                                  step.active
                                    ? "tracker-node-active flex h-11 w-11 items-center justify-center rounded-full bg-[#221c18] text-sm font-semibold text-white"
                                    : "flex h-11 w-11 items-center justify-center rounded-full bg-[#221c18] text-sm font-semibold text-white"
                                }`
                              : step.active
                                ? "tracker-node tracker-node-active flex h-11 w-11 items-center justify-center rounded-full border border-[#c96d38] bg-[#fff4ea] text-sm font-semibold text-[#9c4c20]"
                                : "tracker-node flex h-11 w-11 items-center justify-center rounded-full border border-[#d8cabd] bg-white text-sm font-semibold text-[#8e7b6e]"
                          }
                        >
                          {index + 1}
                        </div>
                        <p
                          className={
                            step.complete
                              ? "mt-3 text-sm font-semibold text-slate-900"
                              : step.active
                                ? "mt-3 text-sm font-semibold text-[#9c4c20]"
                                : "mt-3 text-sm font-semibold text-[#8e7b6e]"
                          }
                        >
                          {step.label}
                        </p>
                      </div>
                      {index < journeySteps.length - 1 ? (
                        <div className="relative h-[2px] flex-1 overflow-hidden rounded-full bg-[#ddc9b9]" aria-hidden="true">
                          <div
                            className={
                              step.complete
                                ? "tracker-line-fill absolute inset-y-0 left-0 rounded-full bg-[#221c18]"
                                : "absolute inset-y-0 left-0 rounded-full bg-transparent"
                            }
                            style={{ width: step.complete ? "100%" : "0%" }}
                          />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_320px]">
                <div className="rounded-[28px] border border-[#eadfd3] bg-white p-5">
                  <p className="label">Order details</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#f5e5d7] px-3 py-1 text-xs font-semibold text-[#6a4d3a]">
                      {order.printType === "color" ? "Color" : "B/W"}
                    </span>
                    <span className="rounded-full bg-[#f5e5d7] px-3 py-1 text-xs font-semibold text-[#6a4d3a]">
                      {order.sideType === "double_side" ? "Double side" : "Single side"}
                    </span>
                    <span className="rounded-full bg-[#f5e5d7] px-3 py-1 text-xs font-semibold text-[#6a4d3a]">
                      {order.pageCount || 0} pages
                    </span>
                    <span className="rounded-full bg-[#f5e5d7] px-3 py-1 text-xs font-semibold text-[#6a4d3a]">
                      {order.copies} copies
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {order.files.map((file) => (
                      <span
                        key={file.id}
                        className="rounded-full bg-[#f3f1ee] px-3 py-1 text-xs font-semibold text-[#5e534a]"
                      >
                        {file.originalFileName}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-[28px] border border-[#eadfd3] bg-[rgba(255,248,241,0.95)] p-5">
                  <p className="label">Shop contact</p>
                  <p className="text-lg font-semibold text-slate-900">{shop?.shopName || "Shop"}</p>
                  {shop?.address ? <p className="mt-2 text-sm text-slate-600">{shop.address}</p> : null}

                  {shop ? (
                    <div className="mt-4 flex flex-wrap gap-3">
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
                          Directions
                        </a>
                      ) : null}
                      <Link href={`/customer/shop/${shop.id}`} className="btn-secondary">
                        Order again
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>

              {!canAcceptOnlinePayment &&
              order.status === "pending" &&
              payableAmount !== null &&
              (order.paymentStatus === "ready_to_pay" ||
                order.paymentStatus === "payment_failed" ||
                order.paymentStatus === "unpaid") ? (
                <div className="rounded-[24px] bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                  {getShopPaymentUnavailableMessage(shop)}
                </div>
              ) : null}

              {order.paymentStatus === "quote_pending" ? (
                <div className="rounded-[24px] bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
                  The shop is still reviewing the file and has not published the final amount yet.
                </div>
              ) : null}

              {order.paymentStatus === "payment_failed" ? (
                <div className="rounded-[24px] bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  Payment failed. Retry from the pay button once you are ready.
                </div>
              ) : null}

              {order.paymentStatus === "paid" ? (
                <div className="rounded-[24px] bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  Payment received successfully.
                </div>
              ) : null}

              {order.paymentStatus === "refund_pending" ? (
                <div className="rounded-[24px] bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                  Refund in progress.
                </div>
              ) : null}

              {order.paymentStatus === "refunded" ? (
                <div className="rounded-[24px] bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
                  Refunded.
                </div>
              ) : null}

              {order.paymentStatus === "refund_failed" ? (
                <div className="rounded-[24px] bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  Refund failed. Support review is required.
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
