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
  const hydrationSafeProps = { suppressHydrationWarning: true as const };
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [syncingStatus, setSyncingStatus] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const approvalStatus = shop?.approvalStatus || null;
  const hasLinkedAccount = Boolean(shop?.razorpayLinkedAccountId);
  const isApproved = approvalStatus === "approved";
  const isPending = approvalStatus === "pending_approval";
  const isRejected = approvalStatus === "rejected";

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
        throw new Error(payload.error || "Unable to submit shop.");
      }

      if (payload.message) {
        setStatusMessage(payload.message);
      }

      router.replace("/shop-owner/setup");
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "Unable to submit shop.",
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
          {isPending
            ? "Your shop is waiting for approval"
            : isRejected
              ? "Resubmit your print shop"
              : shop
                ? "Manage your print shop"
                : "Create your print shop"}
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Set your shop details, services, settlement details, and base print prices. Admin
          approval is required before customers can access the shop. Once approved, your shop can
          keep accepting orders even if Razorpay online payout setup is still pending.
        </p>
        <p className="mt-2 text-xs leading-6 text-slate-500">
          Razorpay linked account email: {profile.email || "missing email on your profile"}
        </p>
        {isPending ? (
          <div className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Your shop request is pending admin approval. You can still update the details below and
            resubmit them.
          </div>
        ) : null}
        {isRejected ? (
          <div className="mt-4 rounded-[24px] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            The last request was rejected. Review the details below and submit again.
          </div>
        ) : null}
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
            {...hydrationSafeProps}
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
            defaultValue={shop?.city || ""}
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
            defaultValue={shop?.state || ""}
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
            defaultValue={shop?.postalCode || ""}
            required
            {...hydrationSafeProps}
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
            {...hydrationSafeProps}
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
            defaultValue={shop?.description || ""}
            placeholder="Short shop summary"
            {...hydrationSafeProps}
          />
        </div>

        <div className="md:col-span-2">
          <p className="label">Razorpay settlement</p>
          {isApproved && hasLinkedAccount ? (
            <div className="rounded-[24px] border border-[#eadfd3] bg-[rgba(255,248,241,0.82)] p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">
                Linked account: {shop?.razorpayLinkedAccountId}
              </p>
              <p className="mt-2">Status: {shop?.razorpayLinkedAccountStatus || "created"}</p>
              <p className="mt-2">Route product: {shop?.razorpayProductStatus || "not_requested"}</p>
              <p className="mt-2">Beneficiary: {shop?.bankAccountHolderName || "-"}</p>
              <p className="mt-2">
                Bank: {shop?.bankIfsc || "-"} / xxxx{shop?.bankAccountLast4 || ""}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                This shop is approved and can continue serving customers. After online payment
                verification, the server creates the Route transfer to this account.
              </p>
              <button
                type="button"
                onClick={() => void handleSyncStatus()}
                disabled={syncingStatus}
                className="btn-secondary mt-4"
                {...hydrationSafeProps}
              >
                {syncingStatus ? "Syncing..." : "Sync Razorpay status"}
              </button>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2 rounded-[24px] border border-[#eadfd3] bg-[rgba(255,248,241,0.82)] p-4 text-sm text-slate-600">
                Admin approval is required before Razorpay linked account onboarding runs. This
                affects online payouts, not whether the approved shop can fulfill orders.
                {hasLinkedAccount ? (
                  <>
                    <br />
                    Current linked account: {shop?.razorpayLinkedAccountId}
                  </>
                ) : null}
                {shop?.razorpayProductStatus ? (
                  <>
                    <br />
                    Route product status: {shop.razorpayProductStatus}
                  </>
                ) : null}
                {isApproved ? (
                  <>
                    <br />
                    Your shop can stay live while customers pay offline until Route activation is
                    complete.
                  </>
                ) : null}
              </div>

              <div>
                <label className="label" htmlFor="bankAccountHolderName">
                  Account holder name
                </label>
                <input
                  id="bankAccountHolderName"
                  name="bankAccountHolderName"
                  className="input"
                  defaultValue={shop?.bankAccountHolderName || profile.name || ""}
                  required
                  {...hydrationSafeProps}
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
                  required
                  {...hydrationSafeProps}
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
                  defaultValue={shop?.pendingBankAccountNumber || ""}
                  required
                  {...hydrationSafeProps}
                />
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
                  defaultValue={shop?.pendingOwnerPan || ""}
                  required
                  {...hydrationSafeProps}
                />
              </div>

              <label className="md:col-span-2 flex items-start gap-3 rounded-[22px] border border-[#eadfd3] bg-[rgba(255,248,241,0.82)] p-4 text-sm text-slate-600">
                <input
                  type="checkbox"
                  name="acceptRouteTerms"
                  className="mt-1 h-4 w-4 accent-[#0f766e]"
                  defaultChecked={Boolean(shop?.pendingRouteTermsAccepted)}
                  required
                  {...hydrationSafeProps}
                />
                <span>
                  I accept the Razorpay Route onboarding and settlement terms for this shop owner
                  account.
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
            {...hydrationSafeProps}
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
            defaultValue={shop?.pricing?.blackWhiteDouble ?? 0}
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
            defaultValue={shop?.pricing?.colorSingle ?? 0}
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
            defaultValue={shop?.pricing?.colorDouble ?? 0}
            required
            {...hydrationSafeProps}
          />
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      {statusMessage ? <p className="mt-4 text-sm text-emerald-700">{statusMessage}</p> : null}

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full sm:w-auto"
          {...hydrationSafeProps}
        >
          {loading
            ? "Submitting..."
            : isApproved
              ? "Save changes"
              : shop
                ? "Resubmit for approval"
                : "Submit for approval"}
        </button>
      </div>
    </form>
  );
}
