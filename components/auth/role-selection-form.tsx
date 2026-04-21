"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/types";

export function RoleSelectionForm({ nextPath = "" }: { nextPath?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [activeRole, setActiveRole] = useState<UserRole | null>(null);
  const [error, setError] = useState("");

  async function handleRoleSelect(role: UserRole) {
    setLoading(true);
    setActiveRole(role);
    setError("");

    try {
      const response = await fetch("/api/users/me/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to save your role.");
      }

      router.replace(
        role === "customer"
          ? nextPath || "/customer/shops"
          : "/shop-owner/setup",
      );
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to save your role.",
      );
    } finally {
      setLoading(false);
      setActiveRole(null);
    }
  }

  return (
    <div className="panel-strong w-full max-w-2xl p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">One-time setup</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-900">
            Start printing
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Use SnapCopy to send files to a print shop. If you run a shop, use the shop-owner entry.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleRoleSelect("shop_owner")}
          disabled={loading}
          className="btn-secondary shrink-0"
        >
          {loading && activeRole === "shop_owner" ? "Opening..." : "Own a shop"}
        </button>
      </div>

      <button
        type="button"
        onClick={() => void handleRoleSelect("customer")}
        disabled={loading}
        className="w-full rounded-[28px] border border-[#c96d38] bg-[rgba(255,241,228,0.92)] px-6 py-8 text-left shadow-[0_18px_36px_rgba(156,76,32,0.12)] transition hover:border-[#b65f2f]"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Print</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Browse shops, upload files, and place your print order.
            </p>
          </div>
          <span className="rounded-full bg-[#c96d38] px-4 py-2 text-sm font-semibold text-white">
            {loading && activeRole === "customer" ? "Opening..." : "Continue"}
          </span>
        </div>
      </button>

      <div className="mb-6">
        <p className="mt-4 text-sm leading-7 text-slate-600">
          Shop owners can create one shop, receive files, price orders, and manage payouts from their dashboard.
        </p>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
