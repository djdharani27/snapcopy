import type { Shop } from "@/types";

export function canShopReceiveOnlinePayments(
  shop?: Pick<Shop, "razorpayLinkedAccountId"> | null,
) {
  return Boolean(String(shop?.razorpayLinkedAccountId || "").trim());
}

export function getShopPaymentUnavailableMessage() {
  return "This shop cannot receive online payments until payout onboarding is complete.";
}
