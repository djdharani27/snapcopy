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

export function statusLabel(status: OrderStatus) {
  if (status === "downloaded") return "Downloaded";
  if (status === "completed") return "Completed";
  return "Pending";
}

export function statusClassName(status: OrderStatus) {
  if (status === "downloaded") return "status-downloaded";
  if (status === "completed") return "status-completed";
  return "status-pending";
}
