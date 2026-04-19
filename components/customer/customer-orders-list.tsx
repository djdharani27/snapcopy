import Link from "next/link";
import { PayOrderButton } from "@/components/customer/pay-order-button";
import {
  customerStatusLabel,
  formatCurrency,
  formatDate,
  formatTrackingId,
  statusClassName,
} from "@/lib/utils/format";
import {
  canShopReceiveOnlinePayments,
  getShopPaymentUnavailableMessage,
} from "@/lib/payments/shop-readiness";
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
        const canReceiveOnlinePayments = canShopReceiveOnlinePayments(shop);
        const shouldShowPaymentAction =
          order.status === "completed" &&
          order.finalAmount !== null &&
          order.finalAmount !== undefined &&
          order.paymentStatus !== "paid";

        return (
          <article key={order.id} className="panel p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {shop?.shopName || "Shop"}
                  </h3>
                  <span className={`badge ${statusClassName(order.status)}`}>
                    {customerStatusLabel(order.status)}
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
                  {order.copies} copies
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {order.files.map((file) => (
                    <span
                      key={file.id}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                    >
                      {file.originalFileName}
                    </span>
                  ))}
                </div>
              </div>

              <div className="text-left md:text-right">
                {order.finalAmount !== null && order.finalAmount !== undefined ? (
                  <>
                    <p className="text-sm text-slate-500">Final amount</p>
                    <p className="mt-2 text-xl font-semibold text-slate-900">
                      {formatCurrency(order.finalAmount)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">Awaiting final amount</p>
                )}
                {shouldShowPaymentAction && canReceiveOnlinePayments ? (
                  <PayOrderButton
                    orderId={order.id}
                    amount={Number(order.finalAmount)}
                    customerName={profile.name}
                    email={profile.email}
                    phone={profile.phone}
                  />
                ) : null}
                {shouldShowPaymentAction && !canReceiveOnlinePayments ? (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {getShopPaymentUnavailableMessage()} Contact the shop to complete the payment offline.
                  </div>
                ) : null}
                {order.paymentStatus === "paid" ? (
                  <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                    Payment received
                  </div>
                ) : null}
                {shop ? (
                  <Link
                    href={`/customer/shop/${shop.id}`}
                    className="btn-secondary mt-4"
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
