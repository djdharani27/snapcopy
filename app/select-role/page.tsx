import { redirect } from "next/navigation";
import { RoleSelectionForm } from "@/components/auth/role-selection-form";
import { getCurrentUserProfile, requireAuth } from "@/lib/auth/session";

export default async function SelectRolePage() {
  await requireAuth();
  const profile = await getCurrentUserProfile();

  if (profile) {
    redirect(
      profile.role === "customer"
        ? "/customer/shops"
        : "/shop-owner/dashboard",
    );
  }

  return (
    <div className="page-shell flex min-h-screen items-center justify-center px-4 py-10">
      <RoleSelectionForm />
    </div>
  );
}
