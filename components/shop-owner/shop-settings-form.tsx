"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils/format";
import type { Shop } from "@/types";

export function ShopSettingsForm({ shop }: { shop: Shop }) {
  const hydrationSafeProps = { suppressHydrationWarning: true as const };
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/shop-owner/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: formData.get("address"),
          city: formData.get("city"),
          state: formData.get("state"),
          postalCode: formData.get("postalCode"),
          phone: formData.get("phone"),
          description: formData.get("description"),
          services: formData.get("services"),
          pricing: {
            blackWhiteSingle: formData.get("blackWhiteSingle"),
            blackWhiteDouble: formData.get("blackWhiteDouble"),
            colorSingle: formData.get("colorSingle"),
            colorDouble: formData.get("colorDouble"),
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to update shop settings.");
      }

      setMessage(payload.message || "Shop pricing and settings updated.");
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to update shop settings.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="panel-strong p-4 sm:p-6">
        <div className="mb-6">
          <p className="eyebrow">Shop pricing</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-900">
            Current rate card
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Set at least one valid print price above zero before accepting new paid orders.
          </p>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">B/W single</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {formatCurrency(shop.pricing.blackWhiteSingle)}/page
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">B/W double</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {formatCurrency(shop.pricing.blackWhiteDouble)}/page
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Color single</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {formatCurrency(shop.pricing.colorSingle)}/page
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Color double</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {formatCurrency(shop.pricing.colorDouble)}/page
            </p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="blackWhiteSingle">
              B/W single price
            </label>
            <input
              id="blackWhiteSingle"
              name="blackWhiteSingle"
              type="number"
              min="0"
              step="0.01"
              className="input"
              defaultValue={shop.pricing.blackWhiteSingle}
              required
              {...hydrationSafeProps}
            />
          </div>
          <div>
            <label className="label" htmlFor="blackWhiteDouble">
              B/W double price
            </label>
            <input
              id="blackWhiteDouble"
              name="blackWhiteDouble"
              type="number"
              min="0"
              step="0.01"
              className="input"
              defaultValue={shop.pricing.blackWhiteDouble}
              required
              {...hydrationSafeProps}
            />
          </div>
          <div>
            <label className="label" htmlFor="colorSingle">
              Color single price
            </label>
            <input
              id="colorSingle"
              name="colorSingle"
              type="number"
              min="0"
              step="0.01"
              className="input"
              defaultValue={shop.pricing.colorSingle}
              required
              {...hydrationSafeProps}
            />
          </div>
          <div>
            <label className="label" htmlFor="colorDouble">
              Color double price
            </label>
            <input
              id="colorDouble"
              name="colorDouble"
              type="number"
              min="0"
              step="0.01"
              className="input"
              defaultValue={shop.pricing.colorDouble}
              required
              {...hydrationSafeProps}
            />
          </div>
        </div>
      </section>

      <section className="panel p-4 sm:p-6">
        <div className="mb-6">
          <p className="text-sm text-slate-500">Shop details</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">Customer-facing settings</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            These updates do not send the shop back for approval and do not modify Razorpay onboarding.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="label" htmlFor="services">
              Services offered
            </label>
            <input
              id="services"
              name="services"
              className="input"
              defaultValue={shop.services.join(", ")}
              placeholder="Xerox, binding, lamination, scanning"
              {...hydrationSafeProps}
            />
          </div>
          <div>
            <label className="label" htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              className="input"
              defaultValue={shop.phone}
              required
              {...hydrationSafeProps}
            />
          </div>
          <div>
            <label className="label" htmlFor="description">
              Description
            </label>
            <input
              id="description"
              name="description"
              className="input"
              defaultValue={shop.description}
              placeholder="Short shop summary"
              {...hydrationSafeProps}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="address">
              Address
            </label>
            <input
              id="address"
              name="address"
              className="input"
              defaultValue={shop.address}
              required
              {...hydrationSafeProps}
            />
          </div>
          <div>
            <label className="label" htmlFor="city">
              City
            </label>
            <input
              id="city"
              name="city"
              className="input"
              defaultValue={shop.city || ""}
              required
              {...hydrationSafeProps}
            />
          </div>
          <div>
            <label className="label" htmlFor="state">
              State
            </label>
            <input
              id="state"
              name="state"
              className="input"
              defaultValue={shop.state || ""}
              required
              {...hydrationSafeProps}
            />
          </div>
          <div>
            <label className="label" htmlFor="postalCode">
              Pincode
            </label>
            <input
              id="postalCode"
              name="postalCode"
              className="input"
              inputMode="numeric"
              pattern="[0-9]{6}"
              defaultValue={shop.postalCode || ""}
              required
              {...hydrationSafeProps}
            />
          </div>
        </div>
      </section>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <div className="flex justify-end">
        <button type="submit" disabled={loading} className="btn-primary" {...hydrationSafeProps}>
          {loading ? "Saving..." : "Save shop settings"}
        </button>
      </div>
    </form>
  );
}
