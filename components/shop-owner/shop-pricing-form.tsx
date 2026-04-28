"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Shop } from "@/types";

export function ShopPricingForm({ shop }: { shop: Shop }) {
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
      const response = await fetch("/api/shop-owner/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        throw new Error(payload.error || "Unable to update shop pricing.");
      }

      setMessage(payload.message || "Shop pricing updated.");
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to update shop pricing.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <label className="label" htmlFor="blackWhiteSingle">
            Black & White Single Side
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
            Black & White Double Side
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
            Color Single Side
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
            Color Double Side
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

      {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          These prices are optional reference defaults for your shop profile. Actual customer payment is set per order above.
        </p>
        <button type="submit" disabled={loading} className="btn-primary" {...hydrationSafeProps}>
          {loading ? "Saving..." : "Save Pricing"}
        </button>
      </div>
    </form>
  );
}
