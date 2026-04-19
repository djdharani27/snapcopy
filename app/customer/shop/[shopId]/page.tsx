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
      description={shop.address}
      actions={
        <>
          <CustomerNav active="shops" />
          <RefreshButton />
          <Link href="/customer/shops" className="btn-secondary">
            Back to shops
          </Link>
        </>
      }
    >
      <div className="mb-5 grid gap-5 md:grid-cols-2">
        <div className="panel p-5">
          <p className="text-sm text-slate-500">Location</p>
          <p className="mt-3 text-sm leading-6 text-slate-900">{shop.address}</p>
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
          <p className="text-sm text-slate-500">Services</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {shop.services?.length ? (
              shop.services.map((service) => (
                <span
                  key={service}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
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
          <p className="text-sm text-slate-500">Price list</p>
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
