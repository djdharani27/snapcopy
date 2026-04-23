"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BillingAuditLog, BillingConfig, Shop, UserProfile } from "@/types";
import { formatCurrency, formatPaiseToRupees } from "@/lib/utils/format";

interface AdminPanelProps {
  shops: Shop[];
  shopOwners: UserProfile[];
  billing: BillingConfig;
  billingAuditLogs: BillingAuditLog[];
}

interface BillingFormState {
  transactionFeeRupees: string;
  estimatedRazorpayFeePercent: string;
  estimatedGstPercent: string;
  transactionFeeEnabled: boolean;
}

function getBillingFormState(billing: BillingConfig): BillingFormState {
  return {
    transactionFeeRupees: String(formatPaiseToRupees(billing.transactionFeePaise)),
    estimatedRazorpayFeePercent: String(billing.estimatedRazorpayFeePercent),
    estimatedGstPercent: String(billing.estimatedGstPercent),
    transactionFeeEnabled: billing.transactionFeeEnabled,
  };
}

function formatAuditDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export function AdminPanel({
  shops,
  shopOwners,
  billing,
  billingAuditLogs,
}: AdminPanelProps) {
  const router = useRouter();
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [deletingShopId, setDeletingShopId] = useState<string | null>(null);
  const [reviewingShopId, setReviewingShopId] = useState<string | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");
  const [billingMessage, setBillingMessage] = useState("");
  const [billingLoading, setBillingLoading] = useState(false);
  const [resettingBilling, setResettingBilling] = useState(false);
  const [billingForm, setBillingForm] = useState<BillingFormState>(() =>
    getBillingFormState(billing),
  );
  const pendingShops = shops.filter((shop) => shop.approvalStatus === "pending_approval");
  const reviewedShops = shops.filter((shop) => shop.approvalStatus !== "pending_approval");

  async function handleCreateShop(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormLoading(true);
    setFormError("");

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/admin/shops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId: formData.get("ownerId"),
          shopName: formData.get("shopName"),
          address: formData.get("address"),
          city: formData.get("city"),
          state: formData.get("state"),
          postalCode: formData.get("postalCode"),
          googleMapsUrl: formData.get("googleMapsUrl"),
          phone: formData.get("phone"),
          description: formData.get("description"),
          services: formData.get("services"),
          razorpayLinkedAccountId: formData.get("razorpayLinkedAccountId"),
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

      event.currentTarget.reset();
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to create shop.");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleSaveBilling(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBillingLoading(true);
    setBillingMessage("");
    setFormError("");

    try {
      const response = await fetch("/api/admin/billing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopCreationFeePaise: billing.shopCreationFeePaise,
          transactionFeePaise: Math.round(Number(billingForm.transactionFeeRupees || 0) * 100),
          estimatedRazorpayFeePercent: Number(
            billingForm.estimatedRazorpayFeePercent || 0,
          ),
          estimatedGstPercent: Number(billingForm.estimatedGstPercent || 0),
          shopCreationFeeEnabled: billing.shopCreationFeeEnabled,
          transactionFeeEnabled: billingForm.transactionFeeEnabled,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to save billing settings.");
      }

      setBillingMessage("Billing settings saved.");
      router.refresh();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Unable to save billing settings.",
      );
    } finally {
      setBillingLoading(false);
    }
  }

  async function handleResetBilling() {
    setResettingBilling(true);
    setBillingMessage("");
    setFormError("");

    try {
      const response = await fetch("/api/admin/billing", {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to reset billing settings.");
      }

      if (payload.billing) {
        setBillingForm(getBillingFormState(payload.billing));
      }

      setBillingMessage("Billing settings reset to defaults.");
      router.refresh();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Unable to reset billing settings.",
      );
    } finally {
      setResettingBilling(false);
    }
  }

  async function handleDeleteShop(shopId: string, shopName: string) {
    const confirmed = window.confirm(
      `Delete ${shopName}? This also removes its orders, file records, and uploaded files.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingShopId(shopId);

    try {
      const response = await fetch(`/api/admin/shops/${shopId}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to delete shop.");
      }

      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to delete shop.");
    } finally {
      setDeletingShopId(null);
    }
  }

  async function handleReviewShop(shopId: string, action: "approve" | "reject") {
    setReviewingShopId(shopId);
    setFormError("");

    try {
      const response = await fetch(`/api/admin/shops/${shopId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to update shop approval.");
      }

      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to update shop approval.");
    } finally {
      setReviewingShopId(null);
    }
  }

  async function handleClearStorage() {
    const confirmed = window.confirm(
      "Delete only files that have already been downloaded by a shop owner? This cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    setCleanupLoading(true);
    setStorageMessage("");
    setFormError("");

    try {
      const response = await fetch("/api/admin/storage", {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to clear storage.");
      }

      setStorageMessage(
        `Deleted ${payload.deletedS3ObjectCount} S3 objects and ${payload.deletedFileRecordCount} file records.`,
      );
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to clear storage.");
    } finally {
      setCleanupLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="panel p-4 sm:p-6">
        <div className="mb-6">
          <p className="text-sm text-slate-500">Billing settings</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">Payout billing</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            These values drive the existing Razorpay Route payout flow after a customer pays for an
            order. Rupees are edited here, while the backend stores billing amounts in paise.
          </p>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Transaction fee</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {billing.transactionFeeEnabled
                ? `${formatCurrency(formatPaiseToRupees(billing.transactionFeePaise))}/order`
                : "Disabled"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Estimated gateway fee</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {billing.estimatedRazorpayFeePercent}%
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">GST on gateway fee</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {billing.estimatedGstPercent}%
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveBilling} className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="transactionFeeRupees">
              Transaction fee (INR)
            </label>
            <input
              id="transactionFeeRupees"
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={billingForm.transactionFeeRupees}
              onChange={(event) =>
                setBillingForm((current) => ({
                  ...current,
                  transactionFeeRupees: event.target.value,
                }))
              }
            />
          </div>

          <div>
            <label className="label" htmlFor="estimatedRazorpayFeePercent">
              Estimated gateway fee percent
            </label>
            <input
              id="estimatedRazorpayFeePercent"
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={billingForm.estimatedRazorpayFeePercent}
              onChange={(event) =>
                setBillingForm((current) => ({
                  ...current,
                  estimatedRazorpayFeePercent: event.target.value,
                }))
              }
            />
          </div>

          <div>
            <label className="label" htmlFor="estimatedGstPercent">
              Estimated GST percent
            </label>
            <input
              id="estimatedGstPercent"
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={billingForm.estimatedGstPercent}
              onChange={(event) =>
                setBillingForm((current) => ({
                  ...current,
                  estimatedGstPercent: event.target.value,
                }))
              }
            />
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={billingForm.transactionFeeEnabled}
              onChange={(event) =>
                setBillingForm((current) => ({
                  ...current,
                  transactionFeeEnabled: event.target.checked,
                }))
              }
            />
            Enable transaction fee
          </label>

          <div className="md:col-span-2 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={handleResetBilling}
              disabled={resettingBilling}
              className="btn-secondary"
            >
              {resettingBilling ? "Resetting..." : "Reset to defaults"}
            </button>
            <button type="submit" disabled={billingLoading} className="btn-primary">
              {billingLoading ? "Saving..." : "Save billing settings"}
            </button>
          </div>
        </form>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Live summary</p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p>
              Transaction fee:{" "}
              {billingForm.transactionFeeEnabled
                ? `${formatCurrency(Number(billingForm.transactionFeeRupees || 0))}/order`
                : "Disabled"}
            </p>
            <p>Estimated gateway fee: {billingForm.estimatedRazorpayFeePercent || "0"}%</p>
            <p>GST on gateway fee: {billingForm.estimatedGstPercent || "0"}%</p>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Last updated {billing.updatedAt ? formatAuditDate(billing.updatedAt) : "-"} by{" "}
            {billing.updatedBy || "-"}.
          </p>
        </div>

        {billingMessage ? <p className="mt-4 text-sm text-teal-700">{billingMessage}</p> : null}
      </section>

      <section className="panel p-4 sm:p-6">
        <div className="mb-6">
          <p className="text-sm text-slate-500">Audit trail</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">Billing changes</h2>
        </div>

        {billingAuditLogs.length === 0 ? (
          <p className="text-sm text-slate-600">No billing changes logged yet.</p>
        ) : (
          <div className="space-y-4">
            {billingAuditLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600"
              >
                <p className="font-semibold text-slate-900">
                  {log.action} by {log.actorEmail}
                </p>
                <p className="mt-1 text-xs text-slate-500">{formatAuditDate(log.createdAt)}</p>
                <p className="mt-3">
                  Transaction fee:{" "}
                  {formatCurrency(formatPaiseToRupees(log.before.transactionFeePaise))} to{" "}
                  {formatCurrency(formatPaiseToRupees(log.after.transactionFeePaise))}
                </p>
                <p>
                  Gateway fee: {log.before.estimatedRazorpayFeePercent}% to{" "}
                  {log.after.estimatedRazorpayFeePercent}%
                </p>
                <p>
                  GST: {log.before.estimatedGstPercent}% to {log.after.estimatedGstPercent}%
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Storage maintenance</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              Delete downloaded files
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Only files already marked as downloaded by a shop owner can be deleted here. Orders
              stay in Firestore, but those downloaded attachments are permanently removed.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClearStorage}
            disabled={cleanupLoading}
            className="w-full rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
          >
            {cleanupLoading ? "Deleting files..." : "Delete downloaded files"}
          </button>
        </div>
        {storageMessage ? <p className="mt-4 text-sm text-teal-700">{storageMessage}</p> : null}
      </section>

      <section className="panel p-4 sm:p-6">
        <div className="mb-6">
          <p className="text-sm text-slate-500">Shop creation</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">Create shop</h2>
        </div>

        <form onSubmit={handleCreateShop} className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="label" htmlFor="ownerId">
              Shop owner
            </label>
            <select id="ownerId" name="ownerId" className="input" required defaultValue="">
              <option value="" disabled>
                Select a shop owner
              </option>
              {shopOwners.map((owner) => (
                <option key={owner.uid} value={owner.uid}>
                  {owner.name} ({owner.email})
                </option>
              ))}
            </select>
          </div>

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
            <label className="label" htmlFor="city">
              City
            </label>
            <input id="city" name="city" className="input" required />
          </div>

          <div>
            <label className="label" htmlFor="state">
              State
            </label>
            <input id="state" name="state" className="input" required />
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
              maxLength={6}
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
              placeholder="Paste the Google Maps share link"
            />
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

          <div className="md:col-span-2">
            <label className="label" htmlFor="razorpayLinkedAccountId">
              Razorpay linked account ID
            </label>
            <input
              id="razorpayLinkedAccountId"
              name="razorpayLinkedAccountId"
              className="input"
              placeholder="acc_XXXXXXXXXXXXXX"
              required
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
              defaultValue="0"
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
              defaultValue="0"
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
              defaultValue="0"
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
              defaultValue="0"
              required
            />
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button type="submit" disabled={formLoading} className="btn-primary w-full sm:w-auto">
              {formLoading ? "Creating..." : "Create shop"}
            </button>
          </div>
        </form>

        {formError ? <p className="mt-4 text-sm text-red-600">{formError}</p> : null}
      </section>

      <section className="panel p-4 sm:p-6">
        <div className="mb-6">
          <p className="text-sm text-slate-500">Approval queue</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">Pending shop requests</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Shop-owner submissions stay blocked here until an admin approves them. Approval triggers
            the Route onboarding API flow.
          </p>
        </div>

        {pendingShops.length === 0 ? (
          <p className="text-sm text-slate-600">No shop requests are waiting for approval.</p>
        ) : (
          <div className="space-y-4">
            {pendingShops.map((shop) => (
              <div
                key={shop.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600"
              >
                <p className="font-semibold text-slate-900">{shop.shopName}</p>
                <p className="mt-1">{shop.address}</p>
                <p className="mt-1">
                  Owner: {shopOwners.find((owner) => owner.uid === shop.ownerId)?.email || shop.ownerId}
                </p>
                <p className="mt-1">
                  Submitted: {formatAuditDate(shop.approvalSubmittedAt || shop.createdAt)}
                </p>
                <p className="mt-1">
                  Settlement: {shop.bankAccountHolderName || "-"} / {shop.bankIfsc || "-"}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleReviewShop(shop.id, "approve")}
                    disabled={reviewingShopId === shop.id}
                    className="btn-primary"
                  >
                    {reviewingShopId === shop.id ? "Saving..." : "Approve"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleReviewShop(shop.id, "reject")}
                    disabled={reviewingShopId === shop.id}
                    className="btn-secondary"
                  >
                    {reviewingShopId === shop.id ? "Saving..." : "Reject"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel p-4 sm:p-6">
        <div className="mb-6">
          <p className="text-sm text-slate-500">Shop management</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">Delete shops</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Deleting a shop also deletes its orders, file records, and uploaded documents.
          </p>
        </div>

        {reviewedShops.length === 0 ? (
          <p className="text-sm text-slate-600">No shops found.</p>
        ) : (
          <div className="space-y-4">
            {reviewedShops.map((shop) => (
              <div
                key={shop.id}
                className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">{shop.shopName}</p>
                  <p className="mt-1 text-sm text-slate-600">{shop.address}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Owner:{" "}
                    {shopOwners.find((owner) => owner.uid === shop.ownerId)?.email || shop.ownerId}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteShop(shop.id, shop.shopName)}
                  disabled={deletingShopId === shop.id}
                  className="w-full rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70 md:w-auto"
                >
                  {deletingShopId === shop.id ? "Deleting..." : "Delete shop"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
