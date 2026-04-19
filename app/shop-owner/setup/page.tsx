import { unstable_noStore as noStore } from "next/cache";
import { ShopSetupForm } from "@/components/shop-owner/shop-setup-form";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireRole } from "@/lib/auth/session";
import { getShopByOwnerId } from "@/lib/firebase/firestore-admin";

export default async function ShopOwnerSetupPage() {
  noStore();

  const { decoded, profile } = await requireRole("shop_owner");
  const existingShop = await getShopByOwnerId(decoded.uid);

  return (
    <DashboardShell
      profile={profile}
      title={existingShop ? "Shop settings" : "Set up your shop"}
      description="Create or manage the single shop profile used by this MVP. Customers will see your Google Maps location, services, and price list before placing orders."
    >
      <ShopSetupForm shop={existingShop} profile={profile} />
    </DashboardShell>
  );
}
