import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ShopList } from "@/components/customer/shop-list";
import { getAllShops } from "@/lib/firebase/firestore-admin";
import { requireRole } from "@/lib/auth/session";

export default async function CustomerDashboardPage() {
  const { profile } = await requireRole("customer");
  const shops = await getAllShops();

  return (
    <DashboardShell
      profile={profile}
      title="Customer dashboard"
      description="Browse nearby Xerox shops and send printing jobs in a few steps."
    >
      <ShopList shops={shops} />
    </DashboardShell>
  );
}
