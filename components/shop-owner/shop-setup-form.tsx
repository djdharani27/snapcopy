"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Shop, UserProfile } from "@/types";

export function ShopSetupForm({
  shop,
  profile,
}: {
  shop?: Shop | null;
  profile: UserProfile;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [syncingStatus, setSyncingStatus] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const hasLinkedAccount = Boolean(shop?.razorpayLinkedAccountId);
  const needsRouteOnboarding =
    !shop?.razorpayLinkedAccountId ||
    !shop?.razorpayStakeholderId ||
    !shop?.razorpayProductId ||
    !shop?.razorpayProductStatus ||
    shop?.razorpayProductStatus !== "activated";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setStatusMessage("");

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/shops", {
        method: shop ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName: formData.get("shopName"),
          address: formData.get("address"),
          city: formData.get("city"),
          state: formData.get("state"),
          postalCode: formData.get("postalCode"),
          googleMapsUrl: formData.get("googleMapsUrl"),
          phone: formData.get("phone"),
          description: formData.get("description"),
          services: formData.get("services"),
          bankAccountHolderName: formData.get("bankAccountHolderName"),
          bankIfsc: formData.get("bankIfsc"),
          bankAccountNumber: formData.get("bankAccountNumber"),
          ownerPan: formData.get("ownerPan"),
          acceptRouteTerms: formData.get("acceptRouteTerms"),
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

      if (payload.warning) {
        setStatusMessage(payload.warning);
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

  async function handleSyncStatus() {
    setSyncingStatus(true);
    setError("");
    setStatusMessage("");

    try {
      const response = await fetch("/api/shops/sync-status", {
        method: "POST",
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to sync Razorpay status.");
      }

      setStatusMessage("Razorpay status synced.");
      router.refresh();
    } catch (syncError) {
      setError(
        syncError instanceof Error ? syncError.message : "Unable to sync Razorpay status.",
      );
    } finally {
      setSyncingStatus(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel-strong mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <p className="eyebrow">Shop setup</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-3xl">
          {shop ? "Manage your print shop" : "Create your print shop"}
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Set your shop details, services, and base print prices so customers know the expected cost.
        </p>
        <p className="mt-2 text-xs leading-6 text-slate-500">
          Razorpay linked account email: {profile.email || "missing email on your profile"}
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
            Street address
          </label>
          <input
            id="address"
            name="address"
            className="input"
            defaultValue={shop?.address || ""}
            required
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
            defaultValue={shop?.city || ""}
            required
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
            defaultValue={shop?.state || ""}
            required
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
            defaultValue={shop?.postalCode || ""}
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
          <p className="label">Razorpay settlement</p>
          {hasLinkedAccount && !needsRouteOnboarding ? (
            <div className="rounded-[24px] border border-[#eadfd3] bg-[rgba(255,248,241,0.82)] p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">
                Linked account: {shop?.razorpayLinkedAccountId}
              </p>
              <p className="mt-2">
                Status: {shop?.razorpayLinkedAccountStatus || "created"}
              </p>
              <p className="mt-2">
                Route product: {shop?.razorpayProductStatus || "not_requested"}
              </p>
              <p className="mt-2">
                Beneficiary: {shop?.bankAccountHolderName || "-"}
              </p>
              <p className="mt-2">
                Bank: {shop?.bankIfsc || "-"} / xxxx{shop?.bankAccountLast4 || ""}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                This shop already has a Razorpay linked account. After payment verification, the server creates the Route transfer to this account.
              </p>
              <button
                type="button"
                onClick={() => void handleSyncStatus()}
                disabled={syncingStatus}
                className="btn-secondary mt-4"
              >
                {syncingStatus ? "Syncing..." : "Sync Razorpay status"}
              </button>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {hasLinkedAccount ? (
                <div className="md:col-span-2 rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Linked account: {shop?.razorpayLinkedAccountId}
                  <br />
                  Route product status: {shop?.razorpayProductStatus || "not_requested"}
                  <br />
                  Complete the missing Route onboarding fields below so payouts can be activated.
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => void handleSyncStatus()}
                      disabled={syncingStatus}
                      className="btn-secondary"
                    >
                      {syncingStatus ? "Syncing..." : "Sync Razorpay status"}
                    </button>
                  </div>
                </div>
              ) : null}
              <div>
                <label className="label" htmlFor="bankAccountHolderName">
                  Account holder name
                </label>
                <input
                  id="bankAccountHolderName"
                  name="bankAccountHolderName"
                  className="input"
                  defaultValue={shop?.bankAccountHolderName || profile.name || ""}
                />
              </div>

              <div>
                <label className="label" htmlFor="bankIfsc">
                  IFSC
                </label>
                <input
                  id="bankIfsc"
                  name="bankIfsc"
                  className="input"
                  defaultValue={shop?.bankIfsc || ""}
                  placeholder="HDFC0001234"
                />
              </div>

              <div className="md:col-span-2">
                <label className="label" htmlFor="bankAccountNumber">
                  Bank account number
                </label>
                <input
                  id="bankAccountNumber"
                  name="bankAccountNumber"
                  className="input"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Enter the settlement bank account number"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Optional for now. Add it later when Razorpay Route is enabled. Only the last 4 digits are stored in this app.
                </p>
              </div>

              <div>
                <label className="label" htmlFor="ownerPan">
                  Owner PAN
                </label>
                <input
                  id="ownerPan"
                  name="ownerPan"
                  className="input"
                  placeholder="ABCDE1234F"
                  autoCapitalize="characters"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Optional for now. Used later to complete Razorpay Route onboarding.
                </p>
              </div>

              <label className="md:col-span-2 flex items-start gap-3 rounded-[22px] border border-[#eadfd3] bg-[rgba(255,248,241,0.82)] p-4 text-sm text-slate-600">
                <input
                  type="checkbox"
                  name="acceptRouteTerms"
                  className="mt-1 h-4 w-4 accent-[#0f766e]"
                />
                <span>
                  I accept the Razorpay Route onboarding and settlement terms for this shop owner account.
                </span>
              </label>
            </div>
          )}
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
      {statusMessage ? <p className="mt-4 text-sm text-emerald-700">{statusMessage}</p> : null}

      <div className="mt-6 flex justify-end">
        <button type="submit" disabled={loading} className="btn-primary w-full sm:w-auto">
          {loading ? (shop ? "Saving..." : "Creating...") : shop ? "Save changes" : "Create shop"}
        </button>
      </div>
    </form>
  );
}
