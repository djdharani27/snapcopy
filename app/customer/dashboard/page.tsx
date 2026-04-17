import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";

export default async function CustomerDashboardPage() {
  await requireRole("customer");
  redirect("/customer/shops");
}
