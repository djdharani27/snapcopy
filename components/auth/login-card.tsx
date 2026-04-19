"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { useAuth } from "@/components/auth/auth-provider";
import { getFirebaseAuth, hasFirebaseClientEnv } from "@/lib/firebase/client";
import { setClientSession } from "@/lib/auth/client-session";

function getSignInErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";

  if (code === "auth/operation-not-allowed") {
    return "Firebase Email/Password sign-in is disabled. Enable the Email/Password provider in Firebase Authentication.";
  }

  if (code === "auth/invalid-credential") {
    return "Invalid email or password.";
  }

  return error instanceof Error ? error.message : "Sign-in failed.";
}

export function LoginCard({
  nextPath: initialNextPath,
}: {
  nextPath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const hasClientEnv = hasFirebaseClientEnv();
  const nextPath =
    initialNextPath ||
    (searchParams.get("next") && searchParams.get("next") !== "/login"
      ? searchParams.get("next")!
      : "/");

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

    setGoogleLoading(true);
    setError("");

    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(getFirebaseAuth(), provider);
      const token = await credential.user.getIdToken(true);
      await setClientSession(token);
      router.replace(nextPath);
    } catch (signInError) {
      setError(getSignInErrorMessage(signInError));
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleEmailSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasClientEnv) {
      setError("Create .env.local from .env.local.example and add your Firebase web app config.");
      return;
    }

    setEmailLoading(true);
    setError("");

    try {
      const credential = await signInWithEmailAndPassword(
        getFirebaseAuth(),
        email.trim(),
        password,
      );
      const token = await credential.user.getIdToken(true);
      await setClientSession(token);
      router.replace(nextPath);
    } catch (signInError) {
      setError(getSignInErrorMessage(signInError));
    } finally {
      setEmailLoading(false);
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
          Use Google sign-in, or use the demo credential when Firebase Admin is
          configured for seeded accounts.
        </p>
      </div>

      <form onSubmit={handleEmailSignIn} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={emailLoading || googleLoading || authLoading || !hasClientEnv}
            suppressHydrationWarning
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-700"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={emailLoading || googleLoading || authLoading || !hasClientEnv}
            suppressHydrationWarning
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-700"
          />
        </div>

        <button
          type="submit"
          disabled={emailLoading || googleLoading || authLoading || !hasClientEnv}
          className="btn-primary w-full"
        >
          {authLoading
            ? "Checking session..."
            : emailLoading
              ? "Signing in..."
              : "Continue with Email"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        <span>or</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <button
        type="button"
        onClick={handleSignIn}
        disabled={googleLoading || emailLoading || authLoading || !hasClientEnv}
        className="btn-primary w-full"
      >
        {!hasClientEnv
          ? "Add Firebase config first"
          : authLoading
            ? "Checking session..."
          : user
            ? "Redirecting..."
          : googleLoading
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
