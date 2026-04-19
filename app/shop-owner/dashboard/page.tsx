import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RefreshButton } from "@/components/layout/refresh-button";
import { AutoRefresh } from "@/components/shop-owner/auto-refresh";
import { OrdersTable } from "@/components/shop-owner/orders-table";
import { ShopQrCard } from "@/components/shop-owner/shop-qr-card";
import { ShopOwnerNav } from "@/components/shop-owner/shop-owner-nav";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireRole } from "@/lib/auth/session";
import { getOrdersForShop, getShopByOwnerId } from "@/lib/firebase/firestore-admin";

export default async function ShopOwnerDashboardPage() {
  noStore();

  const { decoded, profile } = await requireRole("shop_owner");
  const shop = await getShopByOwnerId(decoded.uid);

  if (!shop) {
    redirect("/shop-owner/setup");
  }

  const orders = await getOrdersForShop(shop.id);

  return (
    <DashboardShell
      profile={profile}
      title={`${shop.shopName} orders`}
      description="Incoming print requests for your shop. Paid orders move through payment verification and a separate Razorpay Route transfer."
      actions={
        <>
          <ShopOwnerNav active="orders" />
          <RefreshButton />
          <Link href="/shop-owner/setup" className="btn-secondary">
            Shop settings
          </Link>
        </>
      }
    >
      <AutoRefresh shopId={shop.id} />
      <div className="mb-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="panel p-5">
          <p className="text-sm text-slate-500">Shop</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {shop.shopName}
          </p>
        </div>
        <div className="panel p-5">
          <p className="text-sm text-slate-500">Google Maps</p>
          {shop.googleMapsUrl ? (
            <a
              href={shop.googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex text-sm font-medium text-teal-700 hover:text-teal-800"
            >
              Open saved location
            </a>
          ) : (
            <p className="mt-2 text-sm leading-6 text-slate-600">
              No Google Maps link added yet.
            </p>
          )}
        </div>
        <div className="panel p-5">
          <p className="text-sm text-slate-500">Address</p>
          <p className="mt-2 text-sm leading-6 text-slate-900">{shop.address}</p>
        </div>
        <div className="panel p-5">
          <p className="text-sm text-slate-500">Phone</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{shop.phone}</p>
        </div>
      </div>

      <div className="mb-5">
        <ShopQrCard shopId={shop.id} />
      </div>

      <OrdersTable orders={orders} />
    </DashboardShell>
  );
}
