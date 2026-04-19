import { unstable_noStore as noStore } from "next/cache";
import { CustomerOrdersList } from "@/components/customer/customer-orders-list";
import { CustomerNav } from "@/components/customer/customer-nav";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { RefreshButton } from "@/components/layout/refresh-button";
import { AutoRefresh } from "@/components/shop-owner/auto-refresh";
import {
  getAllShops,
  getOrdersForCustomer,
} from "@/lib/firebase/firestore-admin";
import { requireRole } from "@/lib/auth/session";

export default async function CustomerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  noStore();

  const { decoded, profile } = await requireRole("customer");
  const { order } = await searchParams;
  const shops = await getAllShops();
  const orders = await getOrdersForCustomer(decoded.uid);
  const shopsById = Object.fromEntries(shops.map((shop) => [shop.id, shop]));

  return (
    <DashboardShell
      profile={profile}
      title="Your orders"
      description="Track print requests, final amounts, and payment status."
      hideIntro
      navigation={<CustomerNav active="orders" />}
      actions={<RefreshButton />}
    >
      <div className="space-y-6">
        <AutoRefresh customerId={decoded.uid} />
        {order === "sent" ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            Order sent successfully.
          </div>
        ) : null}
        <section id="orders">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Recent orders</h2>
            <p className="mt-1 text-sm text-slate-600">
              Track whether your order is sent, in progress, or printed.
            </p>
          </div>
          <CustomerOrdersList orders={orders} shopsById={shopsById} profile={profile} />
        </section>
      </div>
    </DashboardShell>
  );
}
