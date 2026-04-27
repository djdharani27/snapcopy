import { AdminPanel } from "@/components/admin/admin-panel";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { RefreshButton } from "@/components/layout/refresh-button";
import { requireAdmin } from "@/lib/auth/admin";
import {
  getAllShops,
  getOrdersNeedingSettlementAttention,
  getOrdersNeedingTransferAttention,
  getUsersByRole,
} from "@/lib/firebase/firestore-admin";
import { getBillingAuditLogs, getBillingConfig } from "@/lib/platform/billing";

function getMaskedBankAccountLast4(shop: {
  pendingBankAccountNumber?: string;
  bankAccountLast4?: string;
}) {
  const pendingAccountNumber = String(shop.pendingBankAccountNumber || "").replace(/\s/g, "");
  if (pendingAccountNumber) {
    return pendingAccountNumber.slice(-4);
  }

  return String(shop.bankAccountLast4 || "").trim();
}

function getMaskedPanLast4(shop: { pendingOwnerPan?: string }) {
  const pendingPan = String(shop.pendingOwnerPan || "").trim();
  return pendingPan ? pendingPan.slice(-4) : "";
}

export default async function AdminPage() {
  const decoded = await requireAdmin();
  const [
    shops,
    shopOwners,
    billing,
    billingAuditLogs,
    settlementAttentionOrders,
    transferAttentionOrders,
  ] = await Promise.all([
    getAllShops({ includeUnapproved: true }),
    getUsersByRole("shop_owner"),
    getBillingConfig(),
    getBillingAuditLogs(),
    getOrdersNeedingSettlementAttention(),
    getOrdersNeedingTransferAttention(),
  ]);
  const adminShops = shops.map((shop) => {
    const safeShop = { ...shop };
    delete safeShop.pendingBankAccountNumber;
    delete safeShop.pendingOwnerPan;

    return {
      ...safeShop,
      bankAccountLast4Masked: getMaskedBankAccountLast4(shop),
      panLast4Masked: getMaskedPanLast4(shop),
    };
  });

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
        shops={adminShops}
        shopOwners={shopOwners}
        billing={billing}
        billingAuditLogs={billingAuditLogs}
        settlementAttentionOrders={settlementAttentionOrders}
        transferAttentionOrders={transferAttentionOrders}
      />
    </DashboardShell>
  );
}
