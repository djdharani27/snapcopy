"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import type { BillingAuditLog, BillingConfig, OrderWithFiles, Shop, UserProfile } from "@/types";
import { formatCurrency, formatDate, formatPaiseToRupees, formatTrackingId } from "@/lib/utils/format";
import { canShopReceiveOnlinePayments } from "@/lib/payments/shop-readiness";

interface AdminPanelProps {
  shops: Shop[];
  shopOwners: UserProfile[];
  billing: BillingConfig;
  billingAuditLogs: BillingAuditLog[];
  settlementAttentionOrders: OrderWithFiles[];
  transferAttentionOrders: OrderWithFiles[];
}

interface BillingFormState {
  shopCreationFeeRupees: string;
  transactionFeeRupees: string;
  estimatedRazorpayFeePercent: string;
  estimatedGstPercent: string;
  shopCreationFeeEnabled: boolean;
  transactionFeeEnabled: boolean;
}

interface ShopRouteFormState {
  settlementEmail: string;
  razorpayLinkedAccountId: string;
  razorpayLinkedAccountStatus: string;
  razorpayStakeholderId: string;
  razorpayProductId: string;
  razorpayProductStatus: string;
  bankAccountHolderName: string;
  bankIfsc: string;
  bankAccountLast4: string;
}

function getBillingFormState(billing: BillingConfig): BillingFormState {
  return {
    shopCreationFeeRupees: String(formatPaiseToRupees(billing.shopCreationFeePaise)),
    transactionFeeRupees: String(formatPaiseToRupees(billing.transactionFeePaise)),
    estimatedRazorpayFeePercent: String(billing.estimatedRazorpayFeePercent),
    estimatedGstPercent: String(billing.estimatedGstPercent),
    shopCreationFeeEnabled: billing.shopCreationFeeEnabled,
    transactionFeeEnabled: billing.transactionFeeEnabled,
  };
}

function normalizeBillingFormState(
  value?: Partial<BillingFormState> | null,
): BillingFormState {
  return {
    shopCreationFeeRupees: String(value?.shopCreationFeeRupees ?? ""),
    transactionFeeRupees: String(value?.transactionFeeRupees ?? ""),
    estimatedRazorpayFeePercent: String(value?.estimatedRazorpayFeePercent ?? ""),
    estimatedGstPercent: String(value?.estimatedGstPercent ?? ""),
    shopCreationFeeEnabled: Boolean(value?.shopCreationFeeEnabled),
    transactionFeeEnabled: Boolean(value?.transactionFeeEnabled),
  };
}

function formatAuditDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function getMissingSettlementFields(shop: Shop) {
  const requirements = shop.razorpayProductRequirements || [];

  return requirements
    .map((requirement) => String(requirement.fieldReference || "").trim())
    .filter((fieldReference) => fieldReference.startsWith("settlements."));
}

function getShopRouteFormState(shop: Shop): ShopRouteFormState {
  return {
    settlementEmail: String(shop.settlementEmail || ""),
    razorpayLinkedAccountId: String(shop.razorpayLinkedAccountId || ""),
    razorpayLinkedAccountStatus: String(shop.razorpayLinkedAccountStatus || ""),
    razorpayStakeholderId: String(shop.razorpayStakeholderId || ""),
    razorpayProductId: String(shop.razorpayProductId || ""),
    razorpayProductStatus: String(shop.razorpayProductStatus || ""),
    bankAccountHolderName: String(shop.bankAccountHolderName || ""),
    bankIfsc: String(shop.bankIfsc || ""),
    bankAccountLast4: String(shop.bankAccountLast4 || ""),
  };
}

function getApprovalBadge(shop: Shop) {
  switch (shop.approvalStatus) {
    case "pending_approval":
      return {
        label: "Pending Approval",
        className: "bg-amber-100 text-amber-900",
      };
    case "rejected":
      return {
        label: "Rejected",
        className: "bg-rose-100 text-rose-900",
      };
    default:
      return {
        label: "Approved",
        className: "bg-emerald-100 text-emerald-900",
      };
  }
}

function getRouteBadge(shop: Shop) {
  if (!shop.razorpayLinkedAccountId) {
    return {
      label: "Route Not Started",
      className: "bg-slate-100 text-slate-700",
    };
  }

  if (canShopReceiveOnlinePayments(shop)) {
    return {
      label: "Route Activated",
      className: "bg-emerald-100 text-emerald-900",
    };
  }

  if (shop.approvalStatus === "approved") {
    return {
      label: "Route Pending",
      className: "bg-sky-100 text-sky-900",
    };
  }

  return {
    label: "Route Waiting",
    className: "bg-slate-100 text-slate-700",
  };
}

export function AdminPanel({
  shops,
  shopOwners,
  billing,
  billingAuditLogs,
  settlementAttentionOrders,
  transferAttentionOrders,
}: AdminPanelProps) {
  const hydrationSafeProps = { suppressHydrationWarning: true as const };
  const customerPlatformFeeRupees = 0;
  const router = useRouter();
  const { user } = useAuth();
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [deletingShopId, setDeletingShopId] = useState<string | null>(null);
  const [reviewingShopId, setReviewingShopId] = useState<string | null>(null);
  const [savingRouteShopId, setSavingRouteShopId] = useState<string | null>(null);
  const [syncingRouteShopId, setSyncingRouteShopId] = useState<string | null>(null);
  const [resettingRouteShopId, setResettingRouteShopId] = useState<string | null>(null);
  const [settlingOrderId, setSettlingOrderId] = useState<string | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");
  const [billingMessage, setBillingMessage] = useState("");
  const [billingLoading, setBillingLoading] = useState(false);
  const [resettingBilling, setResettingBilling] = useState(false);
  const reviewSubmitLockRef = useRef<string | null>(null);
  const [billingForm, setBillingForm] = useState<BillingFormState>(() =>
    normalizeBillingFormState(getBillingFormState(billing)),
  );
  const [shopRouteForms, setShopRouteForms] = useState<Record<string, ShopRouteFormState>>(() =>
    Object.fromEntries(shops.map((shop) => [shop.id, getShopRouteFormState(shop)])),
  );
  const pendingShops = shops.filter((shop) => shop.approvalStatus === "pending_approval");
  const reviewedShops = shops.filter((shop) => shop.approvalStatus !== "pending_approval");

  useEffect(() => {
    setBillingForm(normalizeBillingFormState(getBillingFormState(billing)));
    setShopRouteForms(
      Object.fromEntries(shops.map((shop) => [shop.id, getShopRouteFormState(shop)])),
    );
  }, [billing, shops]);

  async function getAdminRequestHeaders(contentType?: string) {
    const headers = new Headers();

    if (contentType) {
      headers.set("Content-Type", contentType);
    }

    const token = user ? await user.getIdToken() : null;
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    return headers;
  }

  async function adminFetch(input: RequestInfo | URL, init?: RequestInit) {
    const headers = await getAdminRequestHeaders(
      init?.body ? "application/json" : undefined,
    );

    if (init?.headers) {
      const existingHeaders = new Headers(init.headers);
      existingHeaders.forEach((value, key) => {
        headers.set(key, value);
      });
    }

    return fetch(input, {
      ...init,
      headers,
      credentials: "same-origin",
    });
  }

  async function handleCreateShop(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormLoading(true);
    setFormError("");

    const formData = new FormData(event.currentTarget);

    try {
      const response = await adminFetch("/api/admin/shops", {
        method: "POST",
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
      const response = await adminFetch("/api/admin/billing", {
        method: "PATCH",
        body: JSON.stringify({
          shopCreationFeePaise: Math.round(Number(billingForm.shopCreationFeeRupees || 0) * 100),
          transactionFeePaise: Math.round(Number(billingForm.transactionFeeRupees || 0) * 100),
          estimatedRazorpayFeePercent: Number(
            billingForm.estimatedRazorpayFeePercent || 0,
          ),
          estimatedGstPercent: Number(billingForm.estimatedGstPercent || 0),
          shopCreationFeeEnabled: billingForm.shopCreationFeeEnabled,
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
      const response = await adminFetch("/api/admin/billing", {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to reset billing settings.");
      }

      if (payload.billing) {
        setBillingForm(normalizeBillingFormState(getBillingFormState(payload.billing)));
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
      const response = await adminFetch(`/api/admin/shops/${shopId}`, {
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
    if (reviewSubmitLockRef.current || reviewingShopId || savingRouteShopId === shopId) {
      return;
    }

    reviewSubmitLockRef.current = `${shopId}:${action}`;
    setReviewingShopId(shopId);
    setFormError("");

    try {
      const response = await adminFetch(`/api/admin/shops/${shopId}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to update shop approval.");
      }

      if (payload.message) {
        setBillingMessage(payload.message);
      }

      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to update shop approval.");
    } finally {
      reviewSubmitLockRef.current = null;
      setReviewingShopId(null);
    }
  }

  async function handleSaveRouteDetails(shopId: string) {
    setSavingRouteShopId(shopId);
    setFormError("");

    try {
      const response = await adminFetch(`/api/admin/shops/${shopId}`, {
        method: "PATCH",
        body: JSON.stringify(shopRouteForms[shopId] || {}),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to save Razorpay details.");
      }

      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save Razorpay details.");
    } finally {
      setSavingRouteShopId(null);
    }
  }

  async function handleSyncRouteStatus(shopId: string) {
    setSyncingRouteShopId(shopId);
    setFormError("");

    try {
      const response = await adminFetch(`/api/admin/shops/${shopId}/sync-status`, {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to sync Razorpay status.");
      }

      if (payload.message) {
        setBillingMessage(payload.message);
      }

      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to sync Razorpay status.");
    } finally {
      setSyncingRouteShopId(null);
    }
  }

  async function handleResetRouteOnboarding(shopId: string) {
    const confirmed = window.confirm(
      "Reset Razorpay Route onboarding for this shop? This clears the stored linked account, stakeholder, and product ids so the next approval can create a fresh account.",
    );

    if (!confirmed) {
      return;
    }

    setResettingRouteShopId(shopId);
    setFormError("");

    try {
      const response = await adminFetch(`/api/admin/shops/${shopId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "reset_route_onboarding" }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to reset Route onboarding.");
      }

      if (payload.message) {
        setBillingMessage(payload.message);
      }

      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to reset Route onboarding.");
    } finally {
      setResettingRouteShopId(null);
    }
  }

  async function handleMarkSettlementPaid(orderId: string) {
    setSettlingOrderId(orderId);
    setFormError("");

    try {
      const response = await adminFetch(`/api/admin/orders/${orderId}/settlement`, {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to mark settlement paid.");
      }

      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to mark settlement paid.");
    } finally {
      setSettlingOrderId(null);
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
      const response = await adminFetch("/api/admin/storage", {
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
            These values control the manual split the platform keeps on each paid order. Rupees are
            edited here, while the backend stores billing amounts in paise.
          </p>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Customer platform fee</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {formatCurrency(customerPlatformFeeRupees)}/order
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
              Customer pricing is controlled by the platform commission below and is applied during
              manual Route-based split payouts.
              </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Shop owner setup fee</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {billing.shopCreationFeeEnabled
                ? formatCurrency(formatPaiseToRupees(billing.shopCreationFeePaise))
                : "Disabled"}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              One-time platform fee charged to a shop owner for onboarding.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Platform commission</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {billing.transactionFeeEnabled
                ? `${formatCurrency(formatPaiseToRupees(billing.transactionFeePaise))}/order`
                : "Disabled"}
            </p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
              Flat platform amount retained from each paid order before the shop payout is settled.
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
            <label className="label" htmlFor="shopCreationFeeRupees">
              Shop owner setup fee (INR)
            </label>
            <input
              id="shopCreationFeeRupees"
              type="number"
              min="0"
              step="0.01"
              className="input"
              {...hydrationSafeProps}
              value={billingForm.shopCreationFeeRupees ?? ""}
              onChange={(event) =>
                setBillingForm((current) => ({
                  ...current,
                  shopCreationFeeRupees: event.target.value,
                }))
              }
            />
          </div>

          <div>
            <label className="label" htmlFor="transactionFeeRupees">
              Platform commission (INR)
            </label>
            <input
              id="transactionFeeRupees"
              type="number"
              min="0"
              step="0.01"
              className="input"
              {...hydrationSafeProps}
              value={billingForm.transactionFeeRupees ?? ""}
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
              {...hydrationSafeProps}
              value={billingForm.estimatedRazorpayFeePercent ?? ""}
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
              {...hydrationSafeProps}
              value={billingForm.estimatedGstPercent ?? ""}
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
              {...hydrationSafeProps}
              checked={billingForm.shopCreationFeeEnabled ?? false}
              onChange={(event) =>
                setBillingForm((current) => ({
                  ...current,
                  shopCreationFeeEnabled: event.target.checked,
                }))
              }
            />
            Enable shop owner setup fee
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              {...hydrationSafeProps}
              checked={billingForm.transactionFeeEnabled ?? false}
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
              {...hydrationSafeProps}
            >
              {resettingBilling ? "Resetting..." : "Reset to defaults"}
            </button>
            <button
              type="submit"
              disabled={billingLoading}
              className="btn-primary"
              {...hydrationSafeProps}
            >
              {billingLoading ? "Saving..." : "Save billing settings"}
            </button>
          </div>
        </form>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Live summary</p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p>
              Customer platform fee: {formatCurrency(customerPlatformFeeRupees)}/order
            </p>
            <p>
              Shop owner setup fee:{" "}
              {billingForm.shopCreationFeeEnabled
                ? formatCurrency(Number(billingForm.shopCreationFeeRupees || 0))
                : "Disabled"}
            </p>
            <p>
              Platform commission:{" "}
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
                  Shop owner setup fee:{" "}
                  {formatCurrency(formatPaiseToRupees(log.before.shopCreationFeePaise))} to{" "}
                  {formatCurrency(formatPaiseToRupees(log.after.shopCreationFeePaise))}
                </p>
                <p>
                  Platform commission:{" "}
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
        <div className="mb-6">
          <p className="text-sm text-slate-500">Transfer operations</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">Failed or pending Route transfers</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            These orders are paid on Razorpay, but the Route transfer still needs attention.
          </p>
        </div>

        {transferAttentionOrders.length === 0 ? (
          <p className="text-sm text-slate-600">No Route transfer issues need attention right now.</p>
        ) : (
          <div className="space-y-4">
            {transferAttentionOrders.map((order) => {
              const shop = shops.find((entry) => entry.id === order.shopId);

              return (
                <div
                  key={order.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full bg-rose-100 px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-rose-900">
                      {order.transferStatus || "pending"}
                    </span>
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-700">
                      {order.paymentStatus}
                    </span>
                  </div>
                  <p className="mt-3 font-semibold text-slate-900">
                    {shop?.shopName || "Shop"} | {formatTrackingId(order.shopId, order.trackingCode, order.id)}
                  </p>
                  <p className="mt-1">Order ID: {order.id}</p>
                  <p className="mt-1">
                    Shop payout amount:{" "}
                    {order.shopEarningPaise !== null && order.shopEarningPaise !== undefined
                      ? formatCurrency(order.shopEarningPaise / 100)
                      : "-"}
                  </p>
                  <p className="mt-1">Failure reason: {order.transferFailureReason || "-"}</p>
                  <p className="mt-1">
                    Last transfer update: {formatAuditDate(order.transferUpdatedAt || null)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void handleMarkSettlementPaid(order.id)}
                      disabled
                      className="btn-secondary opacity-60"
                      {...hydrationSafeProps}
                    >
                      Waiting for Route reconciliation
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel p-4 sm:p-6">
        <div className="mb-6">
          <p className="text-sm text-slate-500">Settlement operations</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">Pending shop settlements</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            For MVP, customer payments land in the platform account first. Admins track the amount
            payable to each shop here and mark settlements paid manually.
          </p>
        </div>

        {settlementAttentionOrders.length === 0 ? (
          <p className="text-sm text-slate-600">No pending manual settlements right now.</p>
        ) : (
          <div className="space-y-4">
            {settlementAttentionOrders.map((order) => {
              const shop = shops.find((entry) => entry.id === order.shopId);

              return (
                <div
                  key={order.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-amber-900">
                      {order.settlementStatus || "pending"}
                    </span>
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-700">
                      {order.paymentStatus}
                    </span>
                  </div>
                  <p className="mt-3 font-semibold text-slate-900">
                    {shop?.shopName || "Shop"} · {order.customerName}
                  </p>
                  <p className="mt-1">
                    Tracking ID: {formatTrackingId(order.shopId, order.trackingCode, order.id)}
                  </p>
                  <p className="mt-1">Placed: {formatDate(order.createdAt)}</p>
                  <p className="mt-1">
                    Print cost:{" "}
                    {order.printCostPaise !== null && order.printCostPaise !== undefined
                      ? formatCurrency(order.printCostPaise / 100)
                      : "-"}
                  </p>
                  <p className="mt-1">
                    Platform fee:{" "}
                    {order.platformFeePaise !== null && order.platformFeePaise !== undefined
                      ? formatCurrency(order.platformFeePaise / 100)
                      : "-"}
                  </p>
                  <p className="mt-1">
                    Customer total:{" "}
                    {order.totalAmountPaise !== null && order.totalAmountPaise !== undefined
                      ? formatCurrency(order.totalAmountPaise / 100)
                      : "-"}
                  </p>
                  <p className="mt-1">
                    Pending shop amount:{" "}
                    {order.shopEarningPaise !== null && order.shopEarningPaise !== undefined
                      ? formatCurrency(order.shopEarningPaise / 100)
                      : "-"}
                  </p>
                  {order.settlementPaidAt ? (
                    <p className="mt-1">
                      Settlement paid at: {formatDate(order.settlementPaidAt)}
                    </p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void handleMarkSettlementPaid(order.id)}
                      disabled={
                        settlingOrderId === order.id ||
                        order.paymentStatus !== "paid" ||
                        order.settlementStatus === "paid"
                      }
                      className="btn-secondary"
                      {...hydrationSafeProps}
                    >
                      {settlingOrderId === order.id ? "Saving..." : "Mark settlement paid"}
                    </button>
                  </div>
                </div>
              );
            })}
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
            {...hydrationSafeProps}
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
            <select
              id="ownerId"
              name="ownerId"
              className="input"
              required
              defaultValue=""
              {...hydrationSafeProps}
            >
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
            <input id="shopName" name="shopName" className="input" required {...hydrationSafeProps} />
          </div>

          <div className="md:col-span-2">
            <label className="label" htmlFor="address">
              Address
            </label>
            <input id="address" name="address" className="input" required {...hydrationSafeProps} />
          </div>

          <div>
            <label className="label" htmlFor="city">
              City
            </label>
            <input id="city" name="city" className="input" required {...hydrationSafeProps} />
          </div>

          <div>
            <label className="label" htmlFor="state">
              State
            </label>
            <input id="state" name="state" className="input" required {...hydrationSafeProps} />
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
              placeholder="Paste the Google Maps share link"
              {...hydrationSafeProps}
            />
          </div>

          <div>
            <label className="label" htmlFor="phone">
              Phone
            </label>
            <input id="phone" name="phone" className="input" required {...hydrationSafeProps} />
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
              {...hydrationSafeProps}
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
              {...hydrationSafeProps}
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
              defaultValue="0"
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
              defaultValue="0"
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
              defaultValue="0"
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
              defaultValue="0"
              required
              {...hydrationSafeProps}
            />
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={formLoading}
              className="btn-primary w-full sm:w-auto"
              {...hydrationSafeProps}
            >
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
            Shop-owner submissions stay blocked here until an admin approves them. Approval now
            runs the full idempotent Razorpay Route onboarding flow and saves the linked account,
            stakeholder, product, activation status, and blocking reason back to Firestore.
          </p>
        </div>

        {pendingShops.length === 0 ? (
          <p className="text-sm text-slate-600">No shop requests are waiting for approval.</p>
        ) : (
          <div className="space-y-4">
            {pendingShops.map((shop) => (
              <div key={shop.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                {(() => {
                  const isRowBusy =
                    reviewingShopId === shop.id ||
                    savingRouteShopId === shop.id ||
                    syncingRouteShopId === shop.id ||
                    resettingRouteShopId === shop.id;

                  return (
                    <>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em] ${getApprovalBadge(shop).className}`}
                  >
                    {getApprovalBadge(shop).label}
                  </span>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em] ${getRouteBadge(shop).className}`}
                  >
                    {getRouteBadge(shop).label}
                  </span>
                </div>
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
                <p className="mt-1">Settlement email: {shop.settlementEmail || "-"}</p>
                <p className="mt-1">
                  Linked account status: {shop.razorpayLinkedAccountStatus || "-"}
                </p>
                <p className="mt-1">
                  Route product status: {shop.razorpayProductStatus || "-"}
                </p>
                <p className="mt-1">
                  Payment status: {canShopReceiveOnlinePayments(shop) ? "Ready" : "Blocked"}
                </p>
                <p className="mt-1">
                  Last synced: {formatAuditDate(shop.razorpayStatusLastSyncedAt || null)}
                </p>
                {shop.onboardingStep ? (
                  <p className="mt-1 text-amber-800">
                    Onboarding step: {shop.onboardingStep}
                  </p>
                ) : null}
                {shop.onboardingError ? (
                  <p className="mt-1 text-rose-700">
                    Onboarding error: {shop.onboardingError}
                  </p>
                ) : null}
                {shop.paymentBlockedReason ? (
                  <p className="mt-1 text-rose-700">
                    Blocked reason: {shop.paymentBlockedReason}
                  </p>
                ) : null}
                {shop.razorpayProductRequirements?.length ? (
                  <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                    <p className="font-semibold">Razorpay requirements</p>
                    {getMissingSettlementFields(shop).length ? (
                      <p className="mt-2 font-medium">
                        Missing settlement fields: {getMissingSettlementFields(shop).join(", ")}
                      </p>
                    ) : null}
                    <div className="mt-2 space-y-1">
                      {shop.razorpayProductRequirements.map((requirement, index) => (
                        <p key={`${shop.id}-requirement-${index}`}>
                          {[requirement.fieldReference, requirement.reasonCode, requirement.status]
                            .filter(Boolean)
                            .join(" - ")}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <input
                    className="input md:col-span-2"
                    placeholder="Settlement email"
                    type="email"
                    {...hydrationSafeProps}
                    value={shopRouteForms[shop.id]?.settlementEmail || ""}
                    onChange={(event) =>
                      setShopRouteForms((current) => ({
                        ...current,
                        [shop.id]: {
                          ...current[shop.id],
                          settlementEmail: event.target.value,
                        },
                      }))
                    }
                  />
                  <input
                    className="input"
                    placeholder="Linked account id"
                    {...hydrationSafeProps}
                    value={shopRouteForms[shop.id]?.razorpayLinkedAccountId || ""}
                    onChange={(event) =>
                      setShopRouteForms((current) => ({
                        ...current,
                        [shop.id]: {
                          ...current[shop.id],
                          razorpayLinkedAccountId: event.target.value,
                        },
                      }))
                    }
                  />
                  <input
                    className="input"
                    placeholder="Linked account status"
                    {...hydrationSafeProps}
                    value={shopRouteForms[shop.id]?.razorpayLinkedAccountStatus || ""}
                    onChange={(event) =>
                      setShopRouteForms((current) => ({
                        ...current,
                        [shop.id]: {
                          ...current[shop.id],
                          razorpayLinkedAccountStatus: event.target.value,
                        },
                      }))
                    }
                  />
                  <input
                    className="input"
                    placeholder="Stakeholder id"
                    {...hydrationSafeProps}
                    value={shopRouteForms[shop.id]?.razorpayStakeholderId || ""}
                    onChange={(event) =>
                      setShopRouteForms((current) => ({
                        ...current,
                        [shop.id]: {
                          ...current[shop.id],
                          razorpayStakeholderId: event.target.value,
                        },
                      }))
                    }
                  />
                  <input
                    className="input"
                    placeholder="Route product id"
                    {...hydrationSafeProps}
                    value={shopRouteForms[shop.id]?.razorpayProductId || ""}
                    onChange={(event) =>
                      setShopRouteForms((current) => ({
                        ...current,
                        [shop.id]: {
                          ...current[shop.id],
                          razorpayProductId: event.target.value,
                        },
                      }))
                    }
                  />
                  <input
                    className="input"
                    placeholder="Route product status"
                    {...hydrationSafeProps}
                    value={shopRouteForms[shop.id]?.razorpayProductStatus || ""}
                    onChange={(event) =>
                      setShopRouteForms((current) => ({
                        ...current,
                        [shop.id]: {
                          ...current[shop.id],
                          razorpayProductStatus: event.target.value,
                        },
                      }))
                    }
                  />
                  <input
                    className="input"
                    placeholder="Bank account holder name"
                    {...hydrationSafeProps}
                    value={shopRouteForms[shop.id]?.bankAccountHolderName || ""}
                    onChange={(event) =>
                      setShopRouteForms((current) => ({
                        ...current,
                        [shop.id]: {
                          ...current[shop.id],
                          bankAccountHolderName: event.target.value,
                        },
                      }))
                    }
                  />
                  <input
                    className="input"
                    placeholder="Bank IFSC"
                    {...hydrationSafeProps}
                    value={shopRouteForms[shop.id]?.bankIfsc || ""}
                    onChange={(event) =>
                      setShopRouteForms((current) => ({
                        ...current,
                        [shop.id]: {
                          ...current[shop.id],
                          bankIfsc: event.target.value,
                        },
                      }))
                    }
                  />
                  <input
                    className="input md:col-span-2"
                    placeholder="Bank account last 4"
                    {...hydrationSafeProps}
                    value={shopRouteForms[shop.id]?.bankAccountLast4 || ""}
                    onChange={(event) =>
                      setShopRouteForms((current) => ({
                        ...current,
                        [shop.id]: {
                          ...current[shop.id],
                          bankAccountLast4: event.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  Paste a verified linked account id for manual override only. Save Razorpay
                  details now verifies the linked account with Razorpay before storing it.
                </div>
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  Settlement email is the email used for Razorpay linked account creation. It does
                  not change platform login/authentication.
                </div>
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  If the stored linked account is inaccessible, reset Route onboarding here or
                  attach a valid linked account before retrying approval.
                </div>
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  Online payments stay blocked until the Route product reaches{" "}
                  <span className="font-semibold text-slate-900">activated</span>. Use Approve to
                  run the full onboarding flow again, or Sync Razorpay Status to fetch the latest
                  Route product configuration from Razorpay.
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleReviewShop(shop.id, "approve")}
                    disabled={isRowBusy}
                    className="btn-primary"
                    {...hydrationSafeProps}
                  >
                    {reviewingShopId === shop.id ? "Approving..." : "Approve"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleReviewShop(shop.id, "reject")}
                    disabled={isRowBusy}
                    className="btn-secondary"
                    {...hydrationSafeProps}
                  >
                    {reviewingShopId === shop.id ? "Saving..." : "Reject"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveRouteDetails(shop.id)}
                    disabled={isRowBusy}
                    className="btn-secondary"
                    {...hydrationSafeProps}
                  >
                    {savingRouteShopId === shop.id ? "Saving..." : "Save Razorpay details"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSyncRouteStatus(shop.id)}
                    disabled={isRowBusy}
                    className="btn-secondary"
                    {...hydrationSafeProps}
                  >
                    {syncingRouteShopId === shop.id ? "Syncing..." : "Sync Razorpay Status"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleResetRouteOnboarding(shop.id)}
                    disabled={isRowBusy}
                    className="btn-secondary"
                    {...hydrationSafeProps}
                  >
                    {resettingRouteShopId === shop.id
                      ? "Resetting..."
                      : "Reset Route onboarding"}
                  </button>
                </div>
                    </>
                  );
                })()}
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
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em] ${getApprovalBadge(shop).className}`}
                    >
                      {getApprovalBadge(shop).label}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em] ${getRouteBadge(shop).className}`}
                    >
                      {getRouteBadge(shop).label}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-900">{shop.shopName}</p>
                  <p className="mt-1 text-sm text-slate-600">{shop.address}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Owner:{" "}
                    {shopOwners.find((owner) => owner.uid === shop.ownerId)?.email || shop.ownerId}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Settlement email: {shop.settlementEmail || "-"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Linked account status: {shop.razorpayLinkedAccountStatus || "-"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Route product status: {shop.razorpayProductStatus || "-"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Payment status: {canShopReceiveOnlinePayments(shop) ? "Ready" : "Blocked"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Last synced: {formatAuditDate(shop.razorpayStatusLastSyncedAt || null)}
                  </p>
                  {shop.paymentBlockedReason ? (
                    <p className="mt-1 text-xs text-rose-700">
                      Blocked reason: {shop.paymentBlockedReason}
                    </p>
                  ) : null}
                  {shop.razorpayProductRequirements?.length ? (
                    <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                      <p className="font-semibold">Razorpay requirements</p>
                      {getMissingSettlementFields(shop).length ? (
                        <p className="mt-2 font-medium">
                          Missing settlement fields: {getMissingSettlementFields(shop).join(", ")}
                        </p>
                      ) : null}
                      <div className="mt-2 space-y-1">
                        {shop.razorpayProductRequirements.map((requirement, index) => (
                          <p key={`${shop.id}-reviewed-requirement-${index}`}>
                            {[requirement.fieldReference, requirement.reasonCode, requirement.status]
                              .filter(Boolean)
                              .join(" - ")}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <input
                      className="input text-sm md:col-span-2"
                      placeholder="Settlement email"
                      type="email"
                      {...hydrationSafeProps}
                      value={shopRouteForms[shop.id]?.settlementEmail || ""}
                      onChange={(event) =>
                        setShopRouteForms((current) => ({
                          ...current,
                          [shop.id]: {
                            ...current[shop.id],
                            settlementEmail: event.target.value,
                          },
                        }))
                      }
                    />
                    <input
                      className="input text-sm"
                      placeholder="Linked account id"
                      {...hydrationSafeProps}
                      value={shopRouteForms[shop.id]?.razorpayLinkedAccountId || ""}
                      onChange={(event) =>
                        setShopRouteForms((current) => ({
                          ...current,
                          [shop.id]: {
                            ...current[shop.id],
                            razorpayLinkedAccountId: event.target.value,
                          },
                        }))
                      }
                    />
                    <input
                      className="input text-sm"
                      placeholder="Linked account status"
                      {...hydrationSafeProps}
                      value={shopRouteForms[shop.id]?.razorpayLinkedAccountStatus || ""}
                      onChange={(event) =>
                        setShopRouteForms((current) => ({
                          ...current,
                          [shop.id]: {
                            ...current[shop.id],
                            razorpayLinkedAccountStatus: event.target.value,
                          },
                        }))
                      }
                    />
                    <input
                      className="input text-sm"
                      placeholder="Stakeholder id"
                      {...hydrationSafeProps}
                      value={shopRouteForms[shop.id]?.razorpayStakeholderId || ""}
                      onChange={(event) =>
                        setShopRouteForms((current) => ({
                          ...current,
                          [shop.id]: {
                            ...current[shop.id],
                            razorpayStakeholderId: event.target.value,
                          },
                        }))
                      }
                    />
                    <input
                      className="input text-sm"
                      placeholder="Route product id"
                      {...hydrationSafeProps}
                      value={shopRouteForms[shop.id]?.razorpayProductId || ""}
                      onChange={(event) =>
                        setShopRouteForms((current) => ({
                          ...current,
                          [shop.id]: {
                            ...current[shop.id],
                            razorpayProductId: event.target.value,
                          },
                        }))
                      }
                    />
                    <input
                      className="input text-sm"
                      placeholder="Route product status"
                      {...hydrationSafeProps}
                      value={shopRouteForms[shop.id]?.razorpayProductStatus || ""}
                      onChange={(event) =>
                        setShopRouteForms((current) => ({
                          ...current,
                          [shop.id]: {
                            ...current[shop.id],
                            razorpayProductStatus: event.target.value,
                          },
                        }))
                      }
                    />
                    <input
                      className="input text-sm"
                      placeholder="Bank account holder name"
                      {...hydrationSafeProps}
                      value={shopRouteForms[shop.id]?.bankAccountHolderName || ""}
                      onChange={(event) =>
                        setShopRouteForms((current) => ({
                          ...current,
                          [shop.id]: {
                            ...current[shop.id],
                            bankAccountHolderName: event.target.value,
                          },
                        }))
                      }
                    />
                    <input
                      className="input text-sm"
                      placeholder="Bank IFSC"
                      {...hydrationSafeProps}
                      value={shopRouteForms[shop.id]?.bankIfsc || ""}
                      onChange={(event) =>
                        setShopRouteForms((current) => ({
                          ...current,
                          [shop.id]: {
                            ...current[shop.id],
                            bankIfsc: event.target.value,
                          },
                        }))
                      }
                    />
                    <input
                      className="input text-sm md:col-span-2"
                      placeholder="Bank account last 4"
                      {...hydrationSafeProps}
                      value={shopRouteForms[shop.id]?.bankAccountLast4 || ""}
                      onChange={(event) =>
                        setShopRouteForms((current) => ({
                          ...current,
                          [shop.id]: {
                            ...current[shop.id],
                            bankAccountLast4: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Settlement email is the email used for Razorpay linked account creation.
                  </p>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    If the stored linked account is inaccessible, reset Route onboarding or attach
                    a valid linked account before retrying approval or sync.
                  </p>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Online payment only unlocks after the Route product is `activated`. Sync
                    Razorpay Status only fetches the latest Route product configuration and updates
                    local status.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-3 md:w-auto">
                  <button
                    type="button"
                    onClick={() => void handleSyncRouteStatus(shop.id)}
                    disabled={syncingRouteShopId === shop.id || savingRouteShopId === shop.id}
                    className="btn-secondary w-full md:w-auto"
                    {...hydrationSafeProps}
                  >
                    {syncingRouteShopId === shop.id ? "Syncing..." : "Sync Razorpay Status"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveRouteDetails(shop.id)}
                    disabled={
                      savingRouteShopId === shop.id ||
                      syncingRouteShopId === shop.id ||
                      resettingRouteShopId === shop.id
                    }
                    className="btn-secondary w-full md:w-auto"
                    {...hydrationSafeProps}
                  >
                    {savingRouteShopId === shop.id ? "Saving..." : "Save Razorpay details"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleResetRouteOnboarding(shop.id)}
                    disabled={
                      resettingRouteShopId === shop.id ||
                      savingRouteShopId === shop.id ||
                      syncingRouteShopId === shop.id
                    }
                    className="btn-secondary w-full md:w-auto"
                    {...hydrationSafeProps}
                  >
                    {resettingRouteShopId === shop.id
                      ? "Resetting..."
                      : "Reset Route onboarding"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteShop(shop.id, shop.shopName)}
                    disabled={deletingShopId === shop.id || resettingRouteShopId === shop.id}
                    className="w-full rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70 md:w-auto"
                    {...hydrationSafeProps}
                  >
                    {deletingShopId === shop.id ? "Deleting..." : "Delete shop"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
