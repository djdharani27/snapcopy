import { redirect } from "next/navigation";
import { LoginCard } from "@/components/auth/login-card";
import { getCurrentUserProfile, getCurrentToken } from "@/lib/auth/session";
import { normalizeInternalPath } from "@/lib/utils/url";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const token = await getCurrentToken();
  const profile = await getCurrentUserProfile();
  const { next } = await searchParams;
  const nextPath = normalizeInternalPath(next);
  const redirectPath = nextPath && nextPath !== "/login" ? nextPath : undefined;

  if (token && profile) {
    redirect(
      profile.role === "customer"
        ? redirectPath || "/customer/shops"
        : "/shop-owner/dashboard",
    );
  }

  if (token && !profile) {
    redirect(
      redirectPath ? `/select-role?next=${encodeURIComponent(redirectPath)}` : "/select-role",
    );
  }

  return (
    <div className="page-shell flex min-h-screen items-center justify-center px-4 py-10">
      <LoginCard />
    </div>
  );
}
