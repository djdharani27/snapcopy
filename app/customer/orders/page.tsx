import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { AutoRefresh } from "@/components/shop-owner/auto-refresh";
import { CustomerOrdersList } from "@/components/customer/customer-orders-list";
import { getAllShops, getOrdersForCustomer } from "@/lib/firebase/firestore-admin";
import { requireRole } from "@/lib/auth/session";

export default async function CustomerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  noStore();

  const { decoded, profile } = await requireRole("customer");
  const { order } = await searchParams;
  const [shops, orders] = await Promise.all([getAllShops(), getOrdersForCustomer(decoded.uid)]);
  const shopsById = Object.fromEntries(shops.map((shop) => [shop.id, shop]));

  return (
    <main className="page-shell min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="panel-strong mb-6 overflow-hidden p-5 sm:p-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="eyebrow">Your orders</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/customer/shops" className="btn-primary">
                  Start a new order
                </Link>
                <Link href="/" className="btn-secondary">
                  Home
                </Link>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-[#eadfd3] bg-[rgba(255,248,241,0.9)] px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">{profile.name}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-[#8e7b6e]">Customer view</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/customer/shops" className="nav-pill">
                  Browse
                </Link>
                <Link href="/customer/orders" className="nav-pill-active">
                  Track
                </Link>
              </div>
            </div>
          </div>
        </header>

        <AutoRefresh customerId={decoded.uid} />

        {order === "sent" ? (
          <div className="mb-6 rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            Order placed. The shop will review the document and update the next step here.
          </div>
        ) : null}

        <section id="orders">
          <CustomerOrdersList orders={orders} shopsById={shopsById} profile={profile} />
        </section>
      </div>
    </main>
  );
}
