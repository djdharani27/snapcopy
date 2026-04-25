import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RefreshButton } from "@/components/layout/refresh-button";
import { AutoRefresh } from "@/components/shop-owner/auto-refresh";
import { OrdersTable } from "@/components/shop-owner/orders-table";
import { RouteOnboardingStatusCard } from "@/components/shop-owner/route-onboarding-status-card";
import { ShopQrCard } from "@/components/shop-owner/shop-qr-card";
import { ShopQrToggle } from "@/components/shop-owner/shop-qr-toggle";
import { ShopOwnerNav } from "@/components/shop-owner/shop-owner-nav";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireRole } from "@/lib/auth/session";
import { getOrdersForShop, getShopByOwnerId } from "@/lib/firebase/firestore-admin";
import { canShopReceiveOnlinePayments, getShopPaymentBlockedReason } from "@/lib/payments/shop-readiness";

export default async function ShopOwnerDashboardPage() {
  noStore();

  const { decoded, profile } = await requireRole("shop_owner");
  const shop = await getShopByOwnerId(decoded.uid);

  if (!shop || shop.approvalStatus !== "approved") {
    redirect("/shop-owner/setup");
  }

  const orders = await getOrdersForShop(shop.id);
  const isPaymentReady = canShopReceiveOnlinePayments(shop);

  return (
    <DashboardShell
      profile={profile}
      title={`${shop.shopName} orders`}
      description="Manage paid print orders, update fulfilment status, and monitor Route payout readiness."
      hideIntro
      navigation={<ShopOwnerNav active="orders" />}
      actions={
        <>
          <RefreshButton />
          <Link href="/shop-owner/setup" className="icon-btn" aria-label="Shop settings" title="Shop settings">
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
      <AutoRefresh shopId={shop.id} />
      <RouteOnboardingStatusCard shop={shop} syncEndpoint="/api/shops/sync-status" />
      {!isPaymentReady ? (
        <div className="panel p-6">
          <p className="text-sm text-slate-500">Route onboarding pending</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Online payments are blocked</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{getShopPaymentBlockedReason(shop)}</p>
        </div>
      ) : null}
      <ShopQrToggle>
        <ShopQrCard shopId={shop.id} />
      </ShopQrToggle>
      <OrdersTable orders={orders} />
    </DashboardShell>
  );
}
