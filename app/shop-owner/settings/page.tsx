import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { RefreshButton } from "@/components/layout/refresh-button";
import { ShopOwnerNav } from "@/components/shop-owner/shop-owner-nav";
import { ShopSettingsForm } from "@/components/shop-owner/shop-settings-form";
import { requireRole } from "@/lib/auth/session";
import { getShopByOwnerId } from "@/lib/firebase/firestore-admin";

export default async function ShopOwnerSettingsPage() {
  noStore();

  const { decoded, profile } = await requireRole("shop_owner");
  const shop = await getShopByOwnerId(decoded.uid);

  if (!shop) {
    redirect("/shop-owner/setup");
  }

  if (shop.approvalStatus !== "approved") {
    redirect("/shop-owner/setup");
  }

  return (
    <DashboardShell
      profile={profile}
      title={`${shop.shopName} settings`}
      description="Edit your shop pricing and customer-facing details without reopening approval or changing Razorpay onboarding."
      navigation={<ShopOwnerNav active="settings" />}
      actions={<RefreshButton />}
    >
      <ShopSettingsForm shop={shop} />
    </DashboardShell>
  );
}
