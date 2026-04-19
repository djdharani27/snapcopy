import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerNav } from "@/components/customer/customer-nav";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { RefreshButton } from "@/components/layout/refresh-button";
import { UploadOrderForm } from "@/components/customer/upload-order-form";
import { requireRole } from "@/lib/auth/session";
import { getShopById } from "@/lib/firebase/firestore-admin";
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

  return (
    <DashboardShell
      profile={profile}
      title={shop.shopName}
      description={shop.description || shop.address}
      navigation={<CustomerNav active="shops" />}
      actions={
        <>
          <RefreshButton />
          <Link href="/customer/shops" className="btn-secondary">
            Back to shops
          </Link>
        </>
      }
    >
      <div className="mb-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="panel-dark p-6">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#ffc89b]">
            Shop details
          </p>
          <p className="mt-4 text-sm leading-7 text-[#f0ded0]">{shop.address}</p>
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
                Location
              </a>
            ) : null}
          </div>
        </div>
        <div className="panel p-5">
          <p className="eyebrow">Services</p>
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
              <p className="text-sm text-slate-600">Basic document printing</p>
            )}
          </div>
        </div>
      </div>

      <UploadOrderForm shops={[shop]} profile={profile} initialShopId={shop.id} />

      <div className="mt-5">
        <div className="panel p-5 text-sm text-slate-700">
          <p className="eyebrow">Price list</p>
          <p className="mt-3">
            B/W single: {formatCurrency(shop.pricing.blackWhiteSingle)}
          </p>
          <p>B/W double: {formatCurrency(shop.pricing.blackWhiteDouble)}</p>
          <p>Color single: {formatCurrency(shop.pricing.colorSingle)}</p>
          <p>Color double: {formatCurrency(shop.pricing.colorDouble)}</p>
        </div>
      </div>
    </DashboardShell>
  );
}
