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
      title={
        existingShop?.approvalStatus === "pending_approval"
          ? "Approval pending"
          : existingShop?.approvalStatus === "rejected"
            ? "Resubmit your shop"
            : existingShop
              ? "Shop settings"
              : "Set up your shop"
      }
      description="Submit your shop details for admin approval. Customers can see your shop and place orders only after approval is completed."
    >
      <ShopSetupForm shop={existingShop} profile={profile} />
    </DashboardShell>
  );
}
