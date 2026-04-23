import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { RefreshButton } from "@/components/layout/refresh-button";
import { ShopOwnerNav } from "@/components/shop-owner/shop-owner-nav";
import { requireRole } from "@/lib/auth/session";
import { getOrdersForShop, getShopByOwnerId } from "@/lib/firebase/firestore-admin";
import { formatCurrency } from "@/lib/utils/format";

function getDateKey(value?: string | null) {
  if (!value) return "Unknown";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatRevenueDate(value: string) {
  if (value === "Unknown") return value;

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00+05:30`));
}

export default async function ShopOwnerRevenuePage() {
  noStore();

  const { decoded, profile } = await requireRole("shop_owner");
  const shop = await getShopByOwnerId(decoded.uid);

  if (!shop || shop.approvalStatus !== "approved") {
    redirect("/shop-owner/setup");
  }

  const orders = await getOrdersForShop(shop.id);
  const dailyMetrics = new Map<string, { orderCount: number; revenue: number }>();

  for (const order of orders) {
    if (order.paymentStatus !== "paid" || order.transferStatus === "reversed") {
      continue;
    }

    const key = getDateKey(order.paidAt || order.createdAt);
    const current = dailyMetrics.get(key) ?? { orderCount: 0, revenue: 0 };

    current.orderCount += 1;
    if (order.transferableAmountPaise) {
      current.revenue += Number(order.transferableAmountPaise) / 100;
    } else if (order.finalAmount) {
      current.revenue += Number(order.finalAmount);
    }

    dailyMetrics.set(key, current);
  }

  const dailyRows = Array.from(dailyMetrics.entries())
    .map(([date, metrics]) => ({
      date,
      ...metrics,
    }))
    .sort((a, b) => {
      if (a.date === "Unknown") return 1;
      if (b.date === "Unknown") return -1;
      return b.date.localeCompare(a.date);
    });

  const totalRevenue = dailyRows.reduce((sum, row) => sum + row.revenue, 0);
  const totalOrders = dailyRows.reduce((sum, row) => sum + row.orderCount, 0);

  return (
    <DashboardShell
      profile={profile}
      title={`${shop.shopName} revenue`}
      description="Track paid orders and daily payout totals for your shop."
      hideIntro
      navigation={<ShopOwnerNav active="revenue" />}
      actions={
        <>
          <RefreshButton />
          <Link
            href="/shop-owner/setup"
            className="icon-btn"
            aria-label="Shop settings"
            title="Shop settings"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 .99-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 .99 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51.99H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51.99V15z" />
            </svg>
          </Link>
        </>
      }
    >
      <div className="mb-5 grid gap-5 md:grid-cols-2">
        <div className="panel p-5">
          <p className="text-sm text-slate-500">Paid orders</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{totalOrders}</p>
        </div>
        <div className="panel p-5">
          <p className="text-sm text-slate-500">Total revenue</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {formatCurrency(totalRevenue)}
          </p>
        </div>
      </div>

      {dailyRows.length === 0 ? (
        <div className="panel p-8 text-center text-sm text-slate-600">
          No paid orders yet. Daily revenue will appear here once payments are received.
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-xl font-semibold text-slate-900">Daily totals</h2>
            <p className="mt-1 text-sm text-slate-600">
              Only settled customer payments are included. Revenue reflects the server-calculated
              seller payout after the platform fee and gateway charges.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Date
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Paid orders
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {dailyRows.map((row) => (
                  <tr key={row.date}>
                    <td className="px-5 py-4 text-sm font-medium text-slate-900">
                      {formatRevenueDate(row.date)}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{row.orderCount}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                      {formatCurrency(row.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
