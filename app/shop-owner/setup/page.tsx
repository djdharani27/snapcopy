import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { ShopSetupForm } from "@/components/shop-owner/shop-setup-form";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireRole } from "@/lib/auth/session";
import { getShopByOwnerId } from "@/lib/firebase/firestore-admin";

export default async function ShopOwnerSetupPage() {
  noStore();

  const { decoded, profile } = await requireRole("shop_owner");
  const existingShop = await getShopByOwnerId(decoded.uid);
  const isApproved = existingShop?.approvalStatus === "approved";

  if (isApproved) {
    redirect("/shop-owner/dashboard");
  }

  return (
    <DashboardShell
      profile={profile}
      title={
        existingShop?.approvalStatus === "pending_approval"
          ? "Approval pending"
          : existingShop?.approvalStatus === "rejected"
            ? "Resubmit your shop"
            : "Set up your shop"
      }
      description="Submit your shop details for admin approval. Customers can place orders only after approval and the manual Razorpay setup are completed."
    >
      <ShopSetupForm shop={existingShop} profile={profile} />
    </DashboardShell>
  );
}
