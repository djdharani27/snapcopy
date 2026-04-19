import { redirect } from "next/navigation";
import { LoginCard } from "@/components/auth/login-card";
import { getCurrentUserProfile, getCurrentToken } from "@/lib/auth/session";
import { ensureSeededTestUser } from "@/lib/auth/test-user";
import { hasFirebaseAdminEnv } from "@/lib/firebase/admin";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const testAccountReady = hasFirebaseAdminEnv();

  if (testAccountReady) {
    await ensureSeededTestUser();
  }

  const token = await getCurrentToken();
  const profile = await getCurrentUserProfile();
  const { next } = await searchParams;
  const nextPath = next && next !== "/login" ? next : undefined;

  if (token && profile) {
    redirect(
      profile.role === "customer"
        ? nextPath || "/customer/shops"
        : "/shop-owner/dashboard",
    );
  }

  if (token && !profile) {
    redirect(nextPath ? `/select-role?next=${encodeURIComponent(nextPath)}` : "/select-role");
  }

  return (
    <div className="page-shell flex min-h-screen items-center justify-center px-4 py-10">
      <LoginCard nextPath={nextPath} />
    </div>
  );
}
