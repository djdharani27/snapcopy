import { AdminPanel } from "@/components/admin/admin-panel";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { RefreshButton } from "@/components/layout/refresh-button";
import { requireAdmin } from "@/lib/auth/admin";
import { getAllShops, getOrdersNeedingTransferAttention, getUsersByRole } from "@/lib/firebase/firestore-admin";
import { getBillingAuditLogs, getBillingConfig } from "@/lib/platform/billing";

export default async function AdminPage() {
  const decoded = await requireAdmin();
  const [shops, shopOwners, billing, billingAuditLogs, payoutAttentionOrders] = await Promise.all([
    getAllShops({ includeUnapproved: true }),
    getUsersByRole("shop_owner"),
    getBillingConfig(),
    getBillingAuditLogs(),
    getOrdersNeedingTransferAttention(),
  ]);

  return (
    <DashboardShell
      profile={{
        name: decoded.name || "Admin",
        email: decoded.email || "",
      }}
      title="Admin panel"
      description="Manage payout billing, create shops, remove shops, and clear uploaded files from storage."
      actions={<RefreshButton />}
    >
      <AdminPanel
        shops={shops}
        shopOwners={shopOwners}
        billing={billing}
        billingAuditLogs={billingAuditLogs}
        payoutAttentionOrders={payoutAttentionOrders}
      />
    </DashboardShell>
  );
}
