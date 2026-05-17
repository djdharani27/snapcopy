import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { PrintMarketplace } from "@/components/customer/print-marketplace";
import { requireRole } from "@/lib/auth/session";
import { getShopById } from "@/lib/firebase/firestore-admin";
import {
  canShopReceiveOnlinePayments,
  getShopPaymentUnavailableMessage,
} from "@/lib/payments/shop-readiness";
import { formatCurrency } from "@/lib/utils/format";

export default async function CustomerShopPage({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  noStore();

  const { profile } = await requireRole("customer");
  const { shopId } = await params;
  const shop = await getShopById(shopId);

  if (!shop) {
    notFound();
  }

  const canOrderOnline = canShopReceiveOnlinePayments(shop);

  return (
    <main className="page-shell min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="panel-strong mb-6 overflow-hidden p-5 sm:p-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <p className="eyebrow">Single shop ordering</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-slate-900 sm:text-5xl">
                  {shop.shopName}
                </h1>
                <p className="mt-3 text-sm leading-6 text-[#65594f] sm:text-base">
                  Choose the print category first, upload the file, then finish the order for this
                  specific shop.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/customer/shops" className="btn-secondary">
                  Back to all shops
                </Link>
                <Link href="/customer/orders" className="btn-secondary">
                  Track orders
                </Link>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-[28px] border border-[#eadfd3] bg-[rgba(255,248,241,0.92)] p-5">
                <p className="label">Shop details</p>
                <p className="text-lg font-semibold text-slate-900">{shop.address}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a href={`tel:${shop.phone}`} className="btn-secondary">
                    Call
                  </a>
                  {shop.googleMapsUrl ? (
                    <a href={shop.googleMapsUrl} target="_blank" rel="noreferrer" className="btn-secondary">
                      Directions
                    </a>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {shop.services?.length ? (
                    shop.services.map((service) => (
                      <span
                        key={service}
                        className="rounded-full bg-[#f5e5d7] px-3 py-1 text-xs font-semibold text-[#6a4d3a]"
                      >
                        {service}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full bg-[#f5e5d7] px-3 py-1 text-xs font-semibold text-[#6a4d3a]">
                      Basic document printing
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-[#eadfd3] bg-white p-5">
                <p className="label">Starting rates</p>
                <div className="space-y-2 text-sm text-slate-600">
                  <p>B/W single: {formatCurrency(shop.pricing.blackWhiteSingle)}</p>
                  <p>B/W double: {formatCurrency(shop.pricing.blackWhiteDouble)}</p>
                  <p>Color single: {formatCurrency(shop.pricing.colorSingle)}</p>
                  <p>Color double: {formatCurrency(shop.pricing.colorDouble)}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {canOrderOnline ? (
          <PrintMarketplace shops={[shop]} profile={profile} fixedShopId={shop.id} />
        ) : (
          <div className="panel p-5 text-sm text-amber-900">{getShopPaymentUnavailableMessage(shop)}</div>
        )}
      </div>
    </main>
  );
}
