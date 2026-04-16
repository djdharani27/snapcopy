import { unstable_noStore as noStore } from "next/cache";
import { CustomerOrdersList } from "@/components/customer/customer-orders-list";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { RefreshButton } from "@/components/layout/refresh-button";
import { ShopList } from "@/components/customer/shop-list";
import { AutoRefresh } from "@/components/shop-owner/auto-refresh";
import {
  getAllShops,
  getOrdersForCustomer,
} from "@/lib/firebase/firestore-admin";
import { requireRole } from "@/lib/auth/session";

export default async function CustomerDashboardPage() {
  noStore();

  const { decoded, profile } = await requireRole("customer");
  const shops = await getAllShops();
  const orders = await getOrdersForCustomer(decoded.uid);
  const shopsById = Object.fromEntries(shops.map((shop) => [shop.id, shop]));

  return (
    <DashboardShell
      profile={profile}
      title="Customer dashboard"
      description="Browse nearby Xerox shops and send printing jobs in a few steps."
      actions={<RefreshButton />}
    >
      <div className="space-y-6">
        <AutoRefresh />
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Your orders</h2>
            <p className="mt-1 text-sm text-slate-600">
              Track whether your order is sent, in progress, or printed.
            </p>
          </div>
          <CustomerOrdersList orders={orders} shopsById={shopsById} profile={profile} />
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Available shops</h2>
            <p className="mt-1 text-sm text-slate-600">
              Compare services and base prices before uploading your documents.
            </p>
          </div>
          <ShopList shops={shops} />
        </section>
      </div>
    </DashboardShell>
  );
}
