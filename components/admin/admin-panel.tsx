"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import type {
  AdminShopSensitivePayoutDetails,
  AdminShopSummary,
  BillingAuditLog,
  BillingConfig,
  OrderWithFiles,
  UserProfile,
} from "@/types";
import { formatCurrency, formatDate, formatPaiseToRupees, formatTrackingId } from "@/lib/utils/format";
import { canShopReceiveOnlinePayments } from "@/lib/payments/shop-readiness";

interface AdminPanelProps {
  shops: AdminShopSummary[];
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
  bankAccountHolderName: string;
  bankIfsc: string;
  bankAccountLast4: string;
  onlinePaymentsEnabled: boolean;
  adminVerifiedRazorpayAccount: boolean;
  paymentOnboardingNote: string;
}

interface SensitiveFieldConfig {
  key:
    | "ownerName"
    | "settlementEmail"
    | "phone"
    | "shopName"
    | "fullAddress"
    | "ownerPan"
    | "bankAccountHolderName"
    | "bankAccountNumber"
    | "bankIfsc";
  label: string;
  value: string;
}

function buildSensitiveFields(
  shop: AdminShopSummary,
  details: AdminShopSensitivePayoutDetails,
): SensitiveFieldConfig[] {
  return [
    { key: "ownerName", label: "Owner name", value: details.ownerName },
    { key: "settlementEmail", label: "Email", value: details.settlementEmail },
    { key: "phone", label: "Phone", value: details.phone },
    { key: "shopName", label: "Business name", value: shop.shopName },
    { key: "fullAddress", label: "Address", value: details.fullAddress },
    { key: "ownerPan", label: "PAN", value: details.ownerPan },
    {
      key: "bankAccountHolderName",
      label: "Bank account holder name",
      value: details.bankAccountHolderName,
    },
    {
      key: "bankAccountNumber",
      label: "Bank account number",
      value: details.bankAccountNumber,
    },
    { key: "bankIfsc", label: "IFSC", value: details.bankIfsc },
  ];
}

function buildRazorpayCopyBlock(
  shop: AdminShopSummary,
  details: AdminShopSensitivePayoutDetails,
) {
  return [
    `Shop name: ${shop.shopName}`,
    `Owner name: ${details.ownerName}`,
    `Email: ${details.settlementEmail}`,
    `Phone: ${details.phone}`,
    `Business type: ${details.businessType}`,
    `Address: ${details.fullAddress}`,
    `PAN: ${details.ownerPan}`,
    `Bank account holder: ${details.bankAccountHolderName}`,
    `Bank account number: ${details.bankAccountNumber}`,
    `IFSC: ${details.bankIfsc}`,
  ].join("\n");
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

function getShopRouteFormState(shop: AdminShopSummary): ShopRouteFormState {
  return {
    settlementEmail: String(shop.settlementEmail || ""),
    razorpayLinkedAccountId: String(shop.razorpayLinkedAccountId || ""),
    razorpayLinkedAccountStatus: String(shop.razorpayLinkedAccountStatus || ""),
    bankAccountHolderName: String(shop.bankAccountHolderName || ""),
    bankIfsc: String(shop.bankIfsc || ""),
    bankAccountLast4: String(shop.bankAccountLast4 || ""),
    onlinePaymentsEnabled: Boolean(shop.onlinePaymentsEnabled),
    adminVerifiedRazorpayAccount: Boolean(shop.adminVerifiedRazorpayAccount),
    paymentOnboardingNote: String(shop.paymentOnboardingNote || ""),
  };
}

function getMaskedSubmittedPan(shop: AdminShopSummary) {
  return String(shop.panLast4Masked || "").trim();
}

function getMaskedSubmittedBankAccount(shop: AdminShopSummary) {
  return String(shop.bankAccountLast4Masked || shop.bankAccountLast4 || "").trim();
}

function formatServicesList(services: string[]) {
  return services.length ? services.join(", ") : "-";
}

function getApprovalBadge(shop: AdminShopSummary) {
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

function getRouteBadge(shop: AdminShopSummary) {
  if (!shop.razorpayLinkedAccountId) {
    return {
      label: "Account Not Saved",
      className: "bg-slate-100 text-slate-700",
    };
  }

  if (canShopReceiveOnlinePayments(shop)) {
    return {
      label: "Payments Enabled",
      className: "bg-emerald-100 text-emerald-900",
    };
  }

  if (shop.approvalStatus === "approved") {
    return {
      label: "Manual Setup Pending",
      className: "bg-sky-100 text-sky-900",
    };
  }

  return {
    label: "Awaiting Approval",
    className: "bg-slate-100 text-slate-700",
  };
}

function getLinkedAccountApiStatusWarning(
  status?: string | null,
  adminVerifiedRazorpayAccount?: boolean,
) {
  if (adminVerifiedRazorpayAccount) {
    return "";
  }

  const normalizedStatus = String(status || "").trim().toLowerCase();

  if (!normalizedStatus || normalizedStatus === "activated") {
    return "";
  }

  return `API status is ${status}. Only continue if Razorpay Dashboard shows this account is verified/activated.`;
}

function isZeroPricedOrder(order: Pick<OrderWithFiles, "printCostPaise" | "totalAmountPaise">) {
  return (
    order.printCostPaise !== null &&
    order.printCostPaise !== undefined &&
    (Number(order.printCostPaise) <= 0 ||
      (order.totalAmountPaise !== null &&
        order.totalAmountPaise !== undefined &&
        Number(order.totalAmountPaise) <= 0))
  );
}

function SensitivePayoutDetailsPanel(props: {
  shop: AdminShopSummary;
  details?: AdminShopSensitivePayoutDetails;
  error?: string;
  isLoading: boolean;
  copiedKey: string | null;
  onReveal: (shopId: string) => Promise<void>;
  onCopyField: (shopId: string, fieldKey: string, value: string) => Promise<void>;
  onCopyAll: (shop: AdminShopSummary, details: AdminShopSensitivePayoutDetails) => Promise<void>;
}) {
  const { shop, details, error, isLoading, copiedKey, onReveal, onCopyField, onCopyAll } = props;
  const fields = details ? buildSensitiveFields(shop, details) : [];

  return (
    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-900">
            Sensitive payout details
          </p>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-amber-900/80">
            Full PAN and bank account details stay hidden until an admin explicitly reveals them
            for manual Razorpay onboarding.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onReveal(shop.id)}
          disabled={isLoading}
          className="btn-secondary"
          suppressHydrationWarning
        >
          {isLoading
            ? "Revealing..."
            : details
              ? "Refresh revealed details"
              : "Reveal payout details"}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      {details ? (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {fields.map((field) => (
              <div
                key={field.key}
                className="rounded-xl border border-white/80 bg-white/90 p-3 text-sm text-slate-700"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {field.label}
                </p>
                <div className="mt-2 flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 whitespace-pre-wrap break-all text-slate-900">
                    {field.value || "-"}
                  </p>
                  <button
                    type="button"
                    onClick={() => void onCopyField(shop.id, field.key, field.value)}
                    disabled={!field.value}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    suppressHydrationWarning
                  >
                    {copiedKey === `${shop.id}:${field.key}` ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void onCopyAll(shop, details)}
              className="btn-secondary"
              suppressHydrationWarning
            >
              {copiedKey === `${shop.id}:all` ? "Copied all" : "Copy all for Razorpay"}
            </button>
            <p className="text-xs text-slate-600">
              Route terms accepted: {details.routeTermsAccepted ? "Yes" : "No"}
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
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
  const [settlingOrderId, setSettlingOrderId] = useState<string | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");
  const [billingMessage, setBillingMessage] = useState("");
  const [billingLoading, setBillingLoading] = useState(false);
  const [resettingBilling, setResettingBilling] = useState(false);
  const [loadingSensitiveShopId, setLoadingSensitiveShopId] = useState<string | null>(null);
  const [sensitiveDetailsByShopId, setSensitiveDetailsByShopId] = useState<
    Record<string, AdminShopSensitivePayoutDetails>
  >({});
  const [sensitiveErrorsByShopId, setSensitiveErrorsByShopId] = useState<Record<string, string>>(
    {},
  );
  const [copiedSensitiveKey, setCopiedSensitiveKey] = useState<string | null>(null);
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

  useEffect(() => {
    setSensitiveDetailsByShopId((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([shopId]) => shops.some((shop) => shop.id === shopId)),
      ),
    );
    setSensitiveErrorsByShopId((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([shopId]) => shops.some((shop) => shop.id === shopId)),
      ),
    );
  }, [shops]);

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

  async function copySensitiveValue(shopId: string, fieldKey: string, value: string) {
    if (!value) {
      return;
    }

    await navigator.clipboard.writeText(value);
    const nextCopiedKey = `${shopId}:${fieldKey}`;
    setCopiedSensitiveKey(nextCopiedKey);
    window.setTimeout(() => {
      setCopiedSensitiveKey((current) => (current === nextCopiedKey ? null : current));
    }, 2000);
  }

  async function handleRevealSensitivePayoutDetails(shopId: string) {
    const confirmed = window.confirm(
      "Sensitive PAN and bank details will be shown. Use only for Razorpay onboarding.",
    );

    if (!confirmed) {
      return;
    }

    setLoadingSensitiveShopId(shopId);
    setSensitiveErrorsByShopId((current) => ({
      ...current,
      [shopId]: "",
    }));

    try {
      const response = await adminFetch(`/api/admin/shops/${shopId}/sensitive-payout-details`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load sensitive payout details.");
      }

      setSensitiveDetailsByShopId((current) => ({
        ...current,
        [shopId]: payload.sensitivePayoutDetails as AdminShopSensitivePayoutDetails,
      }));
    } catch (error) {
      setSensitiveErrorsByShopId((current) => ({
        ...current,
        [shopId]:
          error instanceof Error ? error.message : "Unable to load sensitive payout details.",
      }));
    } finally {
      setLoadingSensitiveShopId(null);
    }
  }

  async function handleCopyAllSensitivePayoutDetails(
    shop: AdminShopSummary,
    details: AdminShopSensitivePayoutDetails,
  ) {
    await copySensitiveValue(shop.id, "all", buildRazorpayCopyBlock(shop, details));
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
    setBillingMessage("");

    try {
      const response = await adminFetch(`/api/admin/shops/${shopId}`, {
        method: "PATCH",
        body: JSON.stringify(shopRouteForms[shopId] || {}),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to save Razorpay details.");
      }

      if (payload.message) {
        setBillingMessage(payload.message);
      }

      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save Razorpay details.");
    } finally {
      setSavingRouteShopId(null);
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
                  {isZeroPricedOrder(order) ? (
                    <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                      This order was created before valid pricing was set. Ask customer to place a new order.
                    </p>
                  ) : null}
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
                  {isZeroPricedOrder(order) ? (
                    <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                      This order was created before valid pricing was set. Ask customer to place a new order.
                    </p>
                  ) : null}
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
              placeholder="Optional now, verify later after manual Dashboard setup"
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
            Shop-owner submissions stay blocked here until an admin reviews the submitted details
            and approves the shop. After approval, create and activate the linked account manually
            in Razorpay Dashboard, paste the verified acc_xxx here, and then turn online payments on.
          </p>
        </div>

        {pendingShops.length === 0 ? (
          <p className="text-sm text-slate-600">No shop requests are waiting for approval.</p>
        ) : (
          <div className="space-y-4">
            {pendingShops.map((shop) => (
              <div key={shop.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                {(() => {
                  const isRowBusy = reviewingShopId === shop.id || savingRouteShopId === shop.id;
                  const owner = shopOwners.find((currentOwner) => currentOwner.uid === shop.ownerId);
                  const submittedPanLast4 = getMaskedSubmittedPan(shop);
                  const submittedBankLast4 = getMaskedSubmittedBankAccount(shop);

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
                <p className="mt-1">
                  Submitted: {formatAuditDate(shop.approvalSubmittedAt || shop.createdAt)}
                </p>
                <p className="mt-1">
                  Linked account status: {shop.razorpayLinkedAccountStatus || "-"}
                </p>
                <p className="mt-1">
                  Payment status: {canShopReceiveOnlinePayments(shop) ? "Ready" : "Blocked"}
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Shop-owner submission
                    </p>
                    <p className="mt-2">Owner name: {owner?.name || "-"}</p>
                    <p className="mt-1">Owner email: {owner?.email || shop.ownerId}</p>
                    <p className="mt-1">Settlement email: {shop.settlementEmail || "-"}</p>
                    <p className="mt-1">Phone: {shop.phone || "-"}</p>
                    <p className="mt-1">
                      Address: {[shop.address, shop.city, shop.state, shop.postalCode]
                        .filter(Boolean)
                        .join(", ") || "-"}
                    </p>
                    <p className="mt-1">Business type: {shop.businessType || "-"}</p>
                    <p className="mt-1">Services: {formatServicesList(shop.services || [])}</p>
                    <p className="mt-1">Description: {shop.description || "-"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Payout submission
                    </p>
                    <p className="mt-2">Account holder: {shop.bankAccountHolderName || "-"}</p>
                    <p className="mt-1">Bank IFSC: {shop.bankIfsc || "-"}</p>
                    <p className="mt-1">
                      Bank account last 4: {submittedBankLast4 ? `xxxx${submittedBankLast4}` : "-"}
                    </p>
                    <p className="mt-1">PAN last 4: {submittedPanLast4 || "-"}</p>
                    <p className="mt-1">Current approval status: {shop.approvalStatus || "-"}</p>
                    <p className="mt-1">
                      Online payments enabled: {shop.onlinePaymentsEnabled ? "Yes" : "No"}
                    </p>
                    <p className="mt-1">
                      Saved linked account: {shop.razorpayLinkedAccountId || "-"}
                    </p>
                    <p className="mt-1">
                      Admin payment verification: {shop.adminVerifiedRazorpayAccount ? "Confirmed" : "Pending"}
                    </p>
                    <p className="mt-1">
                      Route terms accepted: {shop.pendingRouteTermsAccepted ? "Yes" : "No"}
                    </p>
                    <p className="mt-1">
                      Payment onboarding note: {shop.paymentOnboardingNote || "-"}
                    </p>
                    <p className="mt-1">
                      Pricing: B/W S {formatCurrency(shop.pricing.blackWhiteSingle)}, B/W D{" "}
                      {formatCurrency(shop.pricing.blackWhiteDouble)}, Color S{" "}
                      {formatCurrency(shop.pricing.colorSingle)}, Color D{" "}
                      {formatCurrency(shop.pricing.colorDouble)}
                    </p>
                  </div>
                </div>
                <SensitivePayoutDetailsPanel
                  shop={shop}
                  details={sensitiveDetailsByShopId[shop.id]}
                  error={sensitiveErrorsByShopId[shop.id]}
                  isLoading={loadingSensitiveShopId === shop.id}
                  copiedKey={copiedSensitiveKey}
                  onReveal={handleRevealSensitivePayoutDetails}
                  onCopyField={copySensitiveValue}
                  onCopyAll={handleCopyAllSensitivePayoutDetails}
                />
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
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 md:col-span-2">
                    <p className="font-semibold text-slate-900">
                      Razorpay API status: {shopRouteForms[shop.id]?.razorpayLinkedAccountStatus || "not_saved"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Informational only. Admin confirmation in Razorpay Dashboard is the source of truth for manual onboarding.
                    </p>
                    {getLinkedAccountApiStatusWarning(
                      shopRouteForms[shop.id]?.razorpayLinkedAccountStatus,
                      shopRouteForms[shop.id]?.adminVerifiedRazorpayAccount,
                    ) ? (
                      <p className="mt-2 text-xs leading-5 text-amber-700">
                        {getLinkedAccountApiStatusWarning(
                          shopRouteForms[shop.id]?.razorpayLinkedAccountStatus,
                          shopRouteForms[shop.id]?.adminVerifiedRazorpayAccount,
                        )}
                      </p>
                    ) : null}
                    {shopRouteForms[shop.id]?.adminVerifiedRazorpayAccount &&
                    shopRouteForms[shop.id]?.onlinePaymentsEnabled ? (
                      <p className="mt-2 text-xs leading-5 text-emerald-700">
                        Linked account verified in Razorpay Dashboard. Online payments enabled.
                      </p>
                    ) : null}
                  </div>
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
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(shopRouteForms[shop.id]?.adminVerifiedRazorpayAccount)}
                      onChange={(event) =>
                        setShopRouteForms((current) => ({
                          ...current,
                          [shop.id]: {
                            ...current[shop.id],
                            adminVerifiedRazorpayAccount: event.target.checked,
                            onlinePaymentsEnabled: event.target.checked
                              ? current[shop.id]?.onlinePaymentsEnabled ?? false
                              : false,
                          },
                        }))
                      }
                    />
                    <span>
                      I confirmed this linked account is Activated/Verified in Razorpay Dashboard
                    </span>
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(shopRouteForms[shop.id]?.onlinePaymentsEnabled)}
                      disabled={!shopRouteForms[shop.id]?.adminVerifiedRazorpayAccount}
                      onChange={(event) =>
                        setShopRouteForms((current) => ({
                          ...current,
                          [shop.id]: {
                            ...current[shop.id],
                            onlinePaymentsEnabled: event.target.checked,
                          },
                        }))
                      }
                    />
                    <span>Online payments enabled</span>
                  </label>
                  <textarea
                    className="input min-h-28 md:col-span-2"
                    placeholder="Payment onboarding note"
                    {...hydrationSafeProps}
                    value={shopRouteForms[shop.id]?.paymentOnboardingNote || ""}
                    onChange={(event) =>
                      setShopRouteForms((current) => ({
                        ...current,
                        [shop.id]: {
                          ...current[shop.id],
                          paymentOnboardingNote: event.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  Create and activate this shop&apos;s linked account manually in Razorpay Dashboard.
                  Then paste the activated <span className="font-semibold text-slate-900">acc_xxx</span>{" "}
                  here and enable online payments.
                </div>
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  The linked account id will not come automatically from Razorpay Dashboard. Admin
                  must manually copy the activated acc_xxx from Razorpay Dashboard and paste it
                  into this app. Save verifies the linked account before storing it.
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
                    {savingRouteShopId === shop.id ? "Saving..." : "Save / Verify"}
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
                className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-start md:justify-between"
              >
                {(() => {
                  const owner = shopOwners.find((currentOwner) => currentOwner.uid === shop.ownerId);
                  const submittedPanLast4 = getMaskedSubmittedPan(shop);
                  const submittedBankLast4 = getMaskedSubmittedBankAccount(shop);

                  return (
                    <>
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
                  <p className="mt-1 text-xs text-slate-500">
                    Linked account status: {shop.razorpayLinkedAccountStatus || "-"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Online payments enabled: {shop.onlinePaymentsEnabled ? "Yes" : "No"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Payment status: {canShopReceiveOnlinePayments(shop) ? "Ready" : "Blocked"}
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Submitted details
                      </p>
                      <p className="mt-2">Owner name: {owner?.name || "-"}</p>
                      <p className="mt-1">Owner email: {owner?.email || shop.ownerId}</p>
                      <p className="mt-1">Settlement email: {shop.settlementEmail || "-"}</p>
                      <p className="mt-1">Phone: {shop.phone || "-"}</p>
                      <p className="mt-1">
                        Address: {[shop.address, shop.city, shop.state, shop.postalCode]
                          .filter(Boolean)
                          .join(", ") || "-"}
                      </p>
                      <p className="mt-1">Business type: {shop.businessType || "-"}</p>
                      <p className="mt-1">Services: {formatServicesList(shop.services || [])}</p>
                      <p className="mt-1">Description: {shop.description || "-"}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Payment onboarding
                      </p>
                      <p className="mt-2">Current approval status: {shop.approvalStatus || "-"}</p>
                      <p className="mt-1">Account holder: {shop.bankAccountHolderName || "-"}</p>
                      <p className="mt-1">Bank IFSC: {shop.bankIfsc || "-"}</p>
                      <p className="mt-1">
                        Bank account last 4: {submittedBankLast4 ? `xxxx${submittedBankLast4}` : "-"}
                      </p>
                      <p className="mt-1">PAN last 4: {submittedPanLast4 || "-"}</p>
                      <p className="mt-1">
                        Saved linked account: {shop.razorpayLinkedAccountId || "-"}
                      </p>
                      <p className="mt-1">
                        Admin payment verification: {shop.adminVerifiedRazorpayAccount ? "Confirmed" : "Pending"}
                      </p>
                      <p className="mt-1">
                        Onboarding details entered: {shop.pendingRouteTermsAccepted ? "Yes" : "No"}
                      </p>
                      <p className="mt-1">
                        Pricing: B/W S {formatCurrency(shop.pricing.blackWhiteSingle)}, B/W D{" "}
                        {formatCurrency(shop.pricing.blackWhiteDouble)}, Color S{" "}
                        {formatCurrency(shop.pricing.colorSingle)}, Color D{" "}
                        {formatCurrency(shop.pricing.colorDouble)}
                      </p>
                      <p className="mt-1">
                        Payment onboarding note: {shop.paymentOnboardingNote || "-"}
                      </p>
                  </div>
                </div>
                  <SensitivePayoutDetailsPanel
                    shop={shop}
                    details={sensitiveDetailsByShopId[shop.id]}
                    error={sensitiveErrorsByShopId[shop.id]}
                    isLoading={loadingSensitiveShopId === shop.id}
                    copiedKey={copiedSensitiveKey}
                    onReveal={handleRevealSensitivePayoutDetails}
                    onCopyField={copySensitiveValue}
                    onCopyAll={handleCopyAllSensitivePayoutDetails}
                  />
                  {shop.paymentBlockedReason ? (
                    <p className="mt-1 text-xs text-rose-700">
                      Blocked reason: {shop.paymentBlockedReason}
                    </p>
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
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 md:col-span-2">
                      <p className="font-semibold text-slate-900">
                        Razorpay API status: {shopRouteForms[shop.id]?.razorpayLinkedAccountStatus || "not_saved"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Informational only. Admin confirmation in Razorpay Dashboard is the source of truth for manual onboarding.
                      </p>
                      {getLinkedAccountApiStatusWarning(
                        shopRouteForms[shop.id]?.razorpayLinkedAccountStatus,
                        shopRouteForms[shop.id]?.adminVerifiedRazorpayAccount,
                      ) ? (
                        <p className="mt-2 text-xs leading-5 text-amber-700">
                          {getLinkedAccountApiStatusWarning(
                            shopRouteForms[shop.id]?.razorpayLinkedAccountStatus,
                            shopRouteForms[shop.id]?.adminVerifiedRazorpayAccount,
                          )}
                        </p>
                      ) : null}
                      {shopRouteForms[shop.id]?.adminVerifiedRazorpayAccount &&
                      shopRouteForms[shop.id]?.onlinePaymentsEnabled ? (
                        <p className="mt-2 text-xs leading-5 text-emerald-700">
                          Linked account verified in Razorpay Dashboard. Online payments enabled.
                        </p>
                      ) : null}
                    </div>
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
                    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(shopRouteForms[shop.id]?.adminVerifiedRazorpayAccount)}
                        onChange={(event) =>
                          setShopRouteForms((current) => ({
                            ...current,
                            [shop.id]: {
                              ...current[shop.id],
                              adminVerifiedRazorpayAccount: event.target.checked,
                              onlinePaymentsEnabled: event.target.checked
                                ? current[shop.id]?.onlinePaymentsEnabled ?? false
                                : false,
                            },
                          }))
                        }
                      />
                      <span>
                        I confirmed this linked account is Activated/Verified in Razorpay Dashboard
                      </span>
                    </label>
                    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(shopRouteForms[shop.id]?.onlinePaymentsEnabled)}
                        disabled={!shopRouteForms[shop.id]?.adminVerifiedRazorpayAccount}
                        onChange={(event) =>
                          setShopRouteForms((current) => ({
                            ...current,
                            [shop.id]: {
                              ...current[shop.id],
                              onlinePaymentsEnabled: event.target.checked,
                            },
                          }))
                        }
                      />
                      <span>Online payments enabled</span>
                    </label>
                    <textarea
                      className="input min-h-28 text-sm md:col-span-2"
                      placeholder="Payment onboarding note"
                      {...hydrationSafeProps}
                      value={shopRouteForms[shop.id]?.paymentOnboardingNote || ""}
                      onChange={(event) =>
                        setShopRouteForms((current) => ({
                          ...current,
                          [shop.id]: {
                            ...current[shop.id],
                            paymentOnboardingNote: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Create and activate this shop&apos;s linked account manually in Razorpay Dashboard.
                    Then paste the activated <span className="font-semibold text-slate-900">acc_xxx</span>{" "}
                    here and enable online payments.
                  </p>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    The linked account ID will not come automatically from Razorpay Dashboard.
                    Admin must manually copy acc_xxx from Razorpay Dashboard and paste it into this
                    app. Save verifies the linked account before storing it.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-3 md:w-auto">
                  <button
                    type="button"
                    onClick={() => void handleSaveRouteDetails(shop.id)}
                    disabled={savingRouteShopId === shop.id}
                    className="btn-secondary w-full md:w-auto"
                    {...hydrationSafeProps}
                  >
                    {savingRouteShopId === shop.id ? "Saving..." : "Save / Verify"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteShop(shop.id, shop.shopName)}
                    disabled={deletingShopId === shop.id}
                    className="w-full rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70 md:w-auto"
                    {...hydrationSafeProps}
                  >
                    {deletingShopId === shop.id ? "Deleting..." : "Delete shop"}
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
    </div>
  );
}
