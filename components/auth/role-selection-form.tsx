"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/types";

const roleCards: {
  role: UserRole;
  title: string;
  description: string;
}[] = [
  {
    role: "customer",
    title: "Customer",
    description: "Browse shops, upload print files, and place orders.",
  },
  {
    role: "shop_owner",
    title: "Shop owner",
    description: "Create one shop and manage incoming print requests.",
  },
];

export function RoleSelectionForm() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<UserRole>("customer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/users/me/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to save your role.");
      }

      router.replace(
        selectedRole === "customer"
          ? "/customer/shops"
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
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel w-full max-w-2xl p-8">
      <div className="mb-6">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.25em] text-teal-700">
          One-time setup
        </p>
        <h1 className="text-3xl font-bold text-slate-900">Choose your role</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          This MVP supports two roles only. Customers place orders. Shop owners
          receive and download documents.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {roleCards.map((card) => {
          const active = selectedRole === card.role;
          return (
            <button
              key={card.role}
              type="button"
              onClick={() => setSelectedRole(card.role)}
              className={`rounded-2xl border p-5 text-left transition ${
                active
                  ? "border-teal-700 bg-teal-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  {card.title}
                </h2>
                <span
                  className={`h-4 w-4 rounded-full border ${
                    active
                      ? "border-teal-700 bg-teal-700"
                      : "border-slate-300 bg-white"
                  }`}
                />
              </div>
              <p className="text-sm leading-6 text-slate-600">
                {card.description}
              </p>
            </button>
          );
        })}
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <div className="mt-6 flex justify-end">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving..." : "Continue"}
        </button>
      </div>
    </form>
  );
}
