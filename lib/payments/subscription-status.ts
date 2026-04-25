import type { Shop } from "@/types";

export const SHOP_SUBSCRIPTION_AMOUNT_PAISE = 4900;
export const CUSTOMER_PLATFORM_FEE_PAISE = 100;
export const SHOP_SUBSCRIPTION_EXTENSION_DAYS = 30;

export function getNextSubscriptionExpiry(currentValue?: string | null) {
  const now = new Date();
  const currentDate = currentValue ? new Date(currentValue) : null;
  const baseDate =
    currentDate && !Number.isNaN(currentDate.getTime()) && currentDate.getTime() > now.getTime()
      ? currentDate
      : now;
  const nextDate = new Date(baseDate);
  nextDate.setUTCDate(nextDate.getUTCDate() + SHOP_SUBSCRIPTION_EXTENSION_DAYS);
  return nextDate.toISOString();
}

export function isShopSubscriptionActive(
  shop?: Pick<Shop, "subscriptionStatus" | "subscriptionValidUntil" | "approvalStatus"> | null,
) {
  if (!shop || shop.approvalStatus !== "approved") {
    return false;
  }

  if (shop.subscriptionStatus !== "active") {
    return false;
  }

  const validUntil = String(shop.subscriptionValidUntil || "").trim();

  if (!validUntil) {
    return false;
  }

  const validUntilDate = new Date(validUntil);

  return !Number.isNaN(validUntilDate.getTime()) && validUntilDate.getTime() > Date.now();
}
