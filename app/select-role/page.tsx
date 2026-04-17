import { redirect } from "next/navigation";
import { RoleSelectionForm } from "@/components/auth/role-selection-form";
import { getCurrentUserProfile, requireAuth } from "@/lib/auth/session";

export default async function SelectRolePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  await requireAuth();
  const profile = await getCurrentUserProfile();
  const { next } = await searchParams;
  const nextPath = next || "";

  if (profile) {
    redirect(
      profile.role === "customer"
        ? nextPath || "/customer/shops"
        : "/shop-owner/dashboard",
    );
  }

  return (
    <div className="page-shell flex min-h-screen items-center justify-center px-4 py-10">
      <RoleSelectionForm nextPath={nextPath} />
    </div>
  );
}
