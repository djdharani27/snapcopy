"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirebaseAuth, hasFirebaseClientEnv } from "@/lib/firebase/client";
import { setClientSession } from "@/lib/auth/client-session";

export function LoginCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const hasClientEnv = hasFirebaseClientEnv();

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
      router.replace(searchParams.get("next") || "/");
      router.refresh();
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
    <div className="panel w-full max-w-md p-8">
      <div className="mb-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.25em] text-teal-700">
          SnapCopy
        </p>
        <h1 className="text-3xl font-bold text-slate-900">
          Sign in to send print orders
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Google sign-in is enough for this MVP. Your role and shop access are
          set after login.
        </p>
      </div>

      <button
        type="button"
        onClick={handleSignIn}
        disabled={loading || !hasClientEnv}
        className="btn-primary w-full"
      >
        {!hasClientEnv
          ? "Add Firebase config first"
          : loading
            ? "Signing in..."
            : "Continue with Google"}
      </button>

      {!hasClientEnv ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Missing Firebase client config. Create `.env.local` in the project root
          and copy the values from your Firebase project settings.
        </div>
      ) : null}

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
