"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Shop } from "@/types";

export function ShopSetupForm({ shop }: { shop?: Shop | null }) {
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
        method: shop ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName: formData.get("shopName"),
          address: formData.get("address"),
          googleMapsUrl: formData.get("googleMapsUrl"),
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
          {shop ? "Manage your print shop" : "Create your print shop"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Set your shop details, services, and base print prices so customers know the expected cost.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label" htmlFor="shopName">
            Shop name
          </label>
          <input
            id="shopName"
            name="shopName"
            className="input"
            defaultValue={shop?.shopName || ""}
            required
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
            defaultValue={shop?.address || ""}
            required
          />
        </div>

        <div className="md:col-span-2">
          <label className="label" htmlFor="googleMapsUrl">
            Google Maps location
          </label>
          <input
            id="googleMapsUrl"
            name="googleMapsUrl"
            className="input"
            type="url"
            inputMode="url"
            defaultValue={shop?.googleMapsUrl || ""}
            placeholder="Paste the Google Maps share link"
          />
          <p className="mt-2 text-xs text-slate-500">
            Optional. If you add it, users can open your shop directly in Google Maps.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="phone">
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            className="input"
            defaultValue={shop?.phone || ""}
            required
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
            defaultValue={shop?.description || ""}
            placeholder="Short shop summary"
          />
        </div>

        <div className="md:col-span-2">
          <label className="label" htmlFor="services">
            Services
          </label>
          <input
            id="services"
            name="services"
            className="input"
            defaultValue={shop?.services?.join(", ") || ""}
            placeholder="Xerox, binding, lamination, scanning"
          />
        </div>

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
            defaultValue={shop?.pricing?.blackWhiteSingle ?? 0}
            required
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
            defaultValue={shop?.pricing?.blackWhiteDouble ?? 0}
            required
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
            defaultValue={shop?.pricing?.colorSingle ?? 0}
            required
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
            defaultValue={shop?.pricing?.colorDouble ?? 0}
            required
          />
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <div className="mt-6 flex justify-end">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? (shop ? "Saving..." : "Creating...") : shop ? "Save changes" : "Create shop"}
        </button>
      </div>
    </form>
  );
}
