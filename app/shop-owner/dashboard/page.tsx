import Link from "next/link";
import { redirect } from "next/navigation";
import { OrdersTable } from "@/components/shop-owner/orders-table";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireRole } from "@/lib/auth/session";
import { getOrdersForShop, getShopByOwnerId } from "@/lib/firebase/firestore-admin";

export default async function ShopOwnerDashboardPage() {
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
      description="Incoming print requests for your shop. Download files from S3 and update order status as work progresses."
      actions={
        <Link href="/shop-owner/setup" className="btn-secondary">
          Shop settings
        </Link>
      }
    >
      <div className="mb-5 grid gap-5 md:grid-cols-3">
        <div className="panel p-5">
          <p className="text-sm text-slate-500">Shop</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {shop.shopName}
          </p>
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

      <OrdersTable orders={orders} />
    </DashboardShell>
  );
}
