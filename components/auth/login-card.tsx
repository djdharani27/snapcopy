"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useAuth } from "@/components/auth/auth-provider";
import { getFirebaseAuth, hasFirebaseClientEnv } from "@/lib/firebase/client";
import { setClientSession } from "@/lib/auth/client-session";

export function LoginCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const hasClientEnv = hasFirebaseClientEnv();
  const nextPath =
    searchParams.get("next") && searchParams.get("next") !== "/login"
      ? searchParams.get("next")!
      : "/";

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    router.replace(nextPath);
  }, [authLoading, nextPath, router, user]);

  async function handleSignIn() {
    if (!hasClientEnv) {
      setError("Create .env.local from .env.local.example and add your Firebase web app config.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(getFirebaseAuth(), provider);
      const token = await credential.user.getIdToken(true);
      await setClientSession(token);
      router.replace(nextPath);
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : "Google sign-in failed.",
      );
      setLoading(false);
    }
  }

  return (
    <div className="panel-strong w-full max-w-md p-5 sm:p-8">
      <div className="mb-8">
        <p className="eyebrow">SnapCopy</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-3xl">
          Sign in to send print orders
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Google sign-in is enough for this MVP. Your role and shop access are set after login.
        </p>
      </div>

      <button
        type="button"
        onClick={handleSignIn}
        disabled={loading || authLoading || !hasClientEnv}
        className="btn-primary w-full"
      >
        {!hasClientEnv
          ? "Add Firebase config first"
          : authLoading
            ? "Checking session..."
          : user
            ? "Redirecting..."
          : loading
            ? "Signing in..."
            : "Continue with Google"}
      </button>

      {!hasClientEnv ? (
        <div className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Missing Firebase client config. Create `.env.local` in the project root
          and copy the values from your Firebase project settings.
        </div>
      ) : null}

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
