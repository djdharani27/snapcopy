import { redirect } from "next/navigation";
import { getCurrentUserProfile, requireAuth } from "@/lib/auth/session";
import { getShopByOwnerId } from "@/lib/firebase/firestore-admin";

export default async function HomePage() {
  const decoded = await requireAuth();
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/select-role");
  }

  if (profile.role === "customer") {
    redirect("/customer/shops");
  }

  const shop = await getShopByOwnerId(decoded.uid);
  redirect(shop ? "/shop-owner/dashboard" : "/shop-owner/setup");
}
