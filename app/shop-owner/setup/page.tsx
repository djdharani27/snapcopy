import { redirect } from "next/navigation";
import { ShopSetupForm } from "@/components/shop-owner/shop-setup-form";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireRole } from "@/lib/auth/session";
import { getShopByOwnerId } from "@/lib/firebase/firestore-admin";

export default async function ShopOwnerSetupPage() {
  const { decoded, profile } = await requireRole("shop_owner");
  const existingShop = await getShopByOwnerId(decoded.uid);

  if (existingShop) {
    redirect("/shop-owner/dashboard");
  }

  return (
    <DashboardShell
      profile={profile}
      title="Set up your shop"
      description="Create the single shop profile used by this MVP. Customers will see it in their dashboard."
    >
      <ShopSetupForm />
    </DashboardShell>
  );
}
