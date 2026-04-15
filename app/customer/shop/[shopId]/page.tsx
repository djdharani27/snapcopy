import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { UploadOrderForm } from "@/components/customer/upload-order-form";
import { requireRole } from "@/lib/auth/session";
import { getShopById } from "@/lib/firebase/firestore-admin";

export default async function CustomerShopPage({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const { profile } = await requireRole("customer");
  const { shopId } = await params;
  const shop = await getShopById(shopId);

  if (!shop) {
    notFound();
  }

  return (
    <DashboardShell
      profile={profile}
      title={shop.shopName}
      description={`${shop.address} | ${shop.phone}`}
      actions={
        <Link href="/customer/dashboard" className="btn-secondary">
          Back to shops
        </Link>
      }
    >
      <UploadOrderForm shop={shop} />
    </DashboardShell>
  );
}
