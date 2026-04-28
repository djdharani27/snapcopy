import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RefreshButton } from "@/components/layout/refresh-button";
import { AutoRefresh } from "@/components/shop-owner/auto-refresh";
import { OrdersTable } from "@/components/shop-owner/orders-table";
import { ShopPricingForm } from "@/components/shop-owner/shop-pricing-form";
import { RouteOnboardingStatusCard } from "@/components/shop-owner/route-onboarding-status-card";
import { ShopQrCard } from "@/components/shop-owner/shop-qr-card";
import { ShopQrToggle } from "@/components/shop-owner/shop-qr-toggle";
import { ShopOwnerNav } from "@/components/shop-owner/shop-owner-nav";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireRole } from "@/lib/auth/session";
import { getOrdersForShop, getShopByOwnerId } from "@/lib/firebase/firestore-admin";
import { canShopReceiveOnlinePayments, getShopPaymentBlockedReason } from "@/lib/payments/shop-readiness";
import { formatCurrency } from "@/lib/utils/format";

export default async function ShopOwnerDashboardPage() {
  noStore();

  const { decoded, profile } = await requireRole("shop_owner");
  const shop = await getShopByOwnerId(decoded.uid);

  if (!shop || shop.approvalStatus !== "approved") {
    redirect("/shop-owner/setup");
  }

  const orders = await getOrdersForShop(shop.id);
  const isPaymentReady = canShopReceiveOnlinePayments(shop);
  const hasLinkedAccount = Boolean(String(shop.razorpayLinkedAccountId || "").trim());
  const areOnlinePaymentsEnabled = Boolean(shop.onlinePaymentsEnabled);

  return (
    <DashboardShell
      profile={profile}
      title={`${shop.shopName} orders`}
      description="Manage paid print orders, update fulfilment status, and monitor manual Razorpay payout readiness."
      hideIntro
      navigation={<ShopOwnerNav active="orders" />}
      actions={
        <>
          <RefreshButton />
          <Link href="/shop-owner/settings" className="icon-btn" aria-label="Shop settings" title="Shop settings">
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
      <RouteOnboardingStatusCard shop={shop} />
      {!isPaymentReady ? (
        <div className="panel p-6">
          <p className="text-sm text-slate-500">Manual payout onboarding pending</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            {areOnlinePaymentsEnabled
              ? "Waiting for admin payment verification"
              : "Shop approved, payment setup pending"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {areOnlinePaymentsEnabled
              ? getShopPaymentBlockedReason(shop)
              : hasLinkedAccount
                ? "Your shop is approved. Admin still needs to finish the manual Razorpay payment enablement before customers can pay online."
                : "Your shop is approved. Admin still needs to create and save the manual Razorpay linked account before customers can pay online."}
          </p>
        </div>
      ) : null}
      <div className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Pricing Settings</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">Shop Pricing</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Keep optional reference prices here without reopening approval or changing Razorpay setup. Customer payments are now quoted per order from the orders list below.
            </p>
          </div>
          <Link href="/shop-owner/settings" className="btn-secondary">
            More shop settings
          </Link>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">B/W single</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {formatCurrency(shop.pricing.blackWhiteSingle)}/page
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">B/W double</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {formatCurrency(shop.pricing.blackWhiteDouble)}/page
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Color single</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {formatCurrency(shop.pricing.colorSingle)}/page
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Color double</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {formatCurrency(shop.pricing.colorDouble)}/page
            </p>
          </div>
        </div>
        <ShopPricingForm shop={shop} />
      </div>
      <ShopQrToggle>
        <ShopQrCard shopId={shop.id} />
      </ShopQrToggle>
      <OrdersTable orders={orders} />
    </DashboardShell>
  );
}
