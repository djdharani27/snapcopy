import { unstable_noStore as noStore } from "next/cache";
import { CustomerNav } from "@/components/customer/customer-nav";
import { ShopQrScanButton } from "@/components/customer/shop-qr-scan-button";
import { ShopList } from "@/components/customer/shop-list";
import { UploadOrderForm } from "@/components/customer/upload-order-form";
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
      title="Send files without the clutter"
      description="Scan the shop QR when you have it. If you don't, browse shops and send the order through a tighter upload flow."
      hideIntro
      navigation={<CustomerNav active="shops" />}
      actions={<RefreshButton />}
    >
      <section className="space-y-5 sm:space-y-6">
        <ShopQrScanButton variant="hero" />

        <div className="grid gap-5 lg:gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="panel min-w-0 p-4 sm:p-5 lg:p-6">
            <div className="mb-4 sm:mb-5">
              <p className="eyebrow">Choose a shop</p>
              <h2 className="section-title mt-2">Browse nearby print counters</h2>
              <p className="section-copy mt-2 max-w-2xl">
                Compare shops, check pricing, and choose where the documents should go before you
                send anything.
              </p>
            </div>
            <ShopList shops={shops} showPricing={false} />
          </div>

          <div className="panel min-w-0 p-4 sm:p-5 lg:p-6">
            <div className="mb-4 sm:mb-5">
              <p className="eyebrow">Manual upload</p>
              <h2 className="section-title mt-2">No QR? Upload from here.</h2>
              <p className="section-copy mt-2">
                Pick the shop inside the form and send the files in the same session.
              </p>
            </div>
            <UploadOrderForm shops={shops} profile={profile} />
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}
