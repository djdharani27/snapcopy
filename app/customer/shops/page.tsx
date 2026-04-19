import { unstable_noStore as noStore } from "next/cache";
import { CustomerNav } from "@/components/customer/customer-nav";
import { ShopQrScanButton } from "@/components/customer/shop-qr-scan-button";
import { ShopList } from "@/components/customer/shop-list";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { RefreshButton } from "@/components/layout/refresh-button";
import { getAllShops } from "@/lib/firebase/firestore-admin";
import { requireRole } from "@/lib/auth/session";

export default async function CustomerShopsPage() {
  noStore();

  const { profile } = await requireRole("customer");
  const shops = await getAllShops();

  return (
    <DashboardShell
      profile={profile}
      title="Browse shops"
      description="Find a nearby Xerox shop and send your documents in a few steps."
      actions={
        <>
          <CustomerNav active="shops" />
          <RefreshButton />
        </>
      }
    >
      <section>
        <div className="mb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Available shops</h2>
              <p className="mt-1 text-sm text-slate-600">
                Compare nearby Xerox shops before uploading your documents.
              </p>
            </div>
            <ShopQrScanButton />
          </div>
        </div>
        <ShopList shops={shops} showPricing={false} />
      </section>
    </DashboardShell>
  );
}
