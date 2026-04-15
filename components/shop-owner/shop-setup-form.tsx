"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ShopSetupForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/shops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName: formData.get("shopName"),
          address: formData.get("address"),
          phone: formData.get("phone"),
          description: formData.get("description"),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to create shop.");
      }

      router.replace("/shop-owner/dashboard");
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to create shop.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.25em] text-teal-700">
          Shop setup
        </p>
        <h1 className="text-3xl font-bold text-slate-900">
          Create your print shop
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          For this MVP, each shop owner can create exactly one shop.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label" htmlFor="shopName">
            Shop name
          </label>
          <input id="shopName" name="shopName" className="input" required />
        </div>

        <div className="md:col-span-2">
          <label className="label" htmlFor="address">
            Address
          </label>
          <input id="address" name="address" className="input" required />
        </div>

        <div>
          <label className="label" htmlFor="phone">
            Phone
          </label>
          <input id="phone" name="phone" className="input" required />
        </div>

        <div>
          <label className="label" htmlFor="description">
            Description
          </label>
          <input
            id="description"
            name="description"
            className="input"
            placeholder="Short shop summary"
          />
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <div className="mt-6 flex justify-end">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Creating..." : "Create shop"}
        </button>
      </div>
    </form>
  );
}
