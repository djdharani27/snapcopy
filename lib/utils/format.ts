import type { OrderStatus } from "@/types";

export function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

export function formatPaiseToRupees(amountInPaise: number) {
  return amountInPaise / 100;
}

export function formatRupeesToPaise(amountInRupees: number) {
  return Math.round(amountInRupees * 100);
}

export function formatTrackingId(
  shopId: string,
  trackingCode?: string | null,
  fallbackOrderId?: string,
) {
  const visibleShopId = String(shopId || "").slice(0, 2);
  const normalizedTrackingCode = String(trackingCode || "").trim();
  if (normalizedTrackingCode) {
    if (normalizedTrackingCode.includes("_")) {
      return `${visibleShopId}${normalizedTrackingCode}`;
    }

    if (/^\d{11,}$/.test(normalizedTrackingCode)) {
      return `${visibleShopId}${normalizedTrackingCode.slice(0, 8)}_${normalizedTrackingCode.slice(8)}`;
    }

    return `${visibleShopId}${normalizedTrackingCode}`;
  }

  return fallbackOrderId || "-";
}

export function statusLabel(status: OrderStatus) {
  if (status === "completed") return "Completed";
  return "Pending";
}

export function customerStatusLabel(status: OrderStatus) {
  if (status === "completed") return "Printed";
  return "Order sent";
}

export function statusClassName(status: OrderStatus) {
  if (status === "completed") return "status-completed";
  return "status-pending";
}
