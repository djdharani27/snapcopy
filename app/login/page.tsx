import { redirect } from "next/navigation";
import { LoginCard } from "@/components/auth/login-card";
import { getCurrentUserProfile, getCurrentToken } from "@/lib/auth/session";

export default async function LoginPage() {
  const token = await getCurrentToken();
  const profile = await getCurrentUserProfile();

  if (token && profile) {
    redirect(profile.role === "customer" ? "/customer/shops" : "/shop-owner/dashboard");
  }

  if (token && !profile) {
    redirect("/select-role");
  }

  return (
    <div className="page-shell flex min-h-screen items-center justify-center px-4 py-10">
      <LoginCard />
    </div>
  );
}
