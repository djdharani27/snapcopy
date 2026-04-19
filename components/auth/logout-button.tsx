"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { getFirebaseAuth, hasFirebaseClientEnv } from "@/lib/firebase/client";
import { clearClientSession } from "@/lib/auth/client-session";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      if (hasFirebaseClientEnv()) {
        await signOut(getFirebaseAuth());
      }
      await clearClientSession();
      router.replace("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="btn-ghost"
      suppressHydrationWarning
    >
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
