import { redirect, notFound } from "next/navigation";
import { getCurrentToken, getCurrentUserProfile } from "@/lib/auth/session";
import { getShopById } from "@/lib/firebase/firestore-admin";

export default async function ShopSharePage({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const { shopId } = await params;
  const shop = await getShopById(shopId);

  if (!shop) {
    notFound();
  }

  const token = await getCurrentToken();
  const profile = await getCurrentUserProfile();
  const nextPath = `/s/${shopId}`;

  if (!token) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  if (!profile) {
    redirect(`/select-role?next=${encodeURIComponent(nextPath)}`);
  }

  if (profile.role !== "customer") {
    redirect("/shop-owner/dashboard");
  }

  redirect(`/customer/shop/${shopId}`);
}
