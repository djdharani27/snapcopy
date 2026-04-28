"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RouteOnboardingStatusCard } from "@/components/shop-owner/route-onboarding-status-card";
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
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const approvalStatus = shop?.approvalStatus || null;
  const hasLinkedAccount = Boolean(shop?.razorpayLinkedAccountId);
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
          businessType: formData.get("businessType"),
          googleMapsUrl: formData.get("googleMapsUrl"),
          phone: formData.get("phone"),
          settlementEmail: formData.get("settlementEmail"),
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
                ? "Update your shop request"
                : "Create your print shop"}
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Set your shop details, services, settlement details, and base print prices. Admin
          approval and manual Razorpay linked-account setup are required before customers can place
          paid orders with this shop. Admins create the linked account in Razorpay Dashboard after
          approval, paste the verified acc_xxx here, and then turn online payments on.
        </p>
        <p className="mt-2 text-xs leading-6 text-slate-500">
          Your Firebase login email stays separate and is only used for platform sign-in.
        </p>
        {isPending ? (
          <div className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Your shop request is pending admin approval. You can still update the details below
            while the admin review is in progress.
          </div>
        ) : null}
        {isRejected ? (
          <div className="mt-4 rounded-[24px] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            The last request was rejected. Review the details below and submit again.
          </div>
        ) : null}
        {shop ? (
          <div className="mt-5">
            <RouteOnboardingStatusCard
              shop={shop}
              compact
            />
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

        <div>
          <label className="label" htmlFor="businessType">
            Business type
          </label>
          <select
            id="businessType"
            name="businessType"
            className="input"
            defaultValue={shop?.businessType || "individual"}
            {...hydrationSafeProps}
          >
            <option value="individual">Individual</option>
            <option value="proprietorship">Proprietorship</option>
            <option value="partnership">Partnership</option>
            <option value="private_limited">Private limited</option>
          </select>
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
          {hasLinkedAccount ? (
            <div className="rounded-[24px] border border-[#eadfd3] bg-[rgba(255,248,241,0.82)] p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">
                Linked account: {shop?.razorpayLinkedAccountId}
              </p>
              <p className="mt-2">Status: {shop?.razorpayLinkedAccountStatus || "created"}</p>
              <p className="mt-2">
                Online payments: {shop?.adminVerifiedRazorpayAccount && shop?.onlinePaymentsEnabled
                  ? "active"
                  : "Waiting for admin payment verification"}
              </p>
              <p className="mt-2">Beneficiary: {shop?.bankAccountHolderName || "-"}</p>
              <p className="mt-2">
                Bank: {shop?.bankIfsc || "-"} / xxxx{shop?.bankAccountLast4 || ""}
              </p>
              {shop?.razorpayStatusLastSyncedAt ? (
                <p className="mt-2 text-xs text-slate-500">
                  Last synced: {new Date(shop.razorpayStatusLastSyncedAt).toLocaleString()}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2 rounded-[24px] border border-[#eadfd3] bg-[rgba(255,248,241,0.82)] p-4 text-sm text-slate-600">
              {hasLinkedAccount
                ? "Admin has already added Razorpay account details for this shop. Update the payout fields below if the admin asks you to correct bank or PAN information."
                : "Admin approval is required before admins create the linked account manually in Razorpay Dashboard. Customers cannot place paid orders until the verified acc_xxx is saved and online payments are enabled."}
            </div>

            <div>
              <label className="label" htmlFor="settlementEmail">
                Settlement Email (used for Razorpay payouts)
              </label>
              <input
                id="settlementEmail"
                name="settlementEmail"
                type="email"
                className="input"
                defaultValue={shop?.settlementEmail || ""}
                placeholder="payouts@yourshop.com"
                required
                {...hydrationSafeProps}
              />
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
                placeholder={
                  hasLinkedAccount
                    ? "Re-enter the settlement bank account number to update Razorpay onboarding"
                    : "Enter the settlement bank account number"
                }
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
                I accept the Razorpay Route onboarding and settlement terms. Admin can use this
                acceptance while configuring the shop manually in Razorpay Dashboard.
              </span>
            </label>
          </div>
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
            : shop
                ? "Resubmit for approval"
                : "Submit for approval"}
        </button>
      </div>
    </form>
  );
}
