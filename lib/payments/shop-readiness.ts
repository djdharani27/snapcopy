import type { Shop } from "@/types";

export function canShopReceiveOnlinePayments(
  shop?: Pick<Shop, "razorpayLinkedAccountId" | "razorpayLinkedAccountStatus" | "razorpayProductStatus"> | null,
) {
  const linkedAccountId = String(shop?.razorpayLinkedAccountId || "").trim();
  const linkedAccountStatus = String(shop?.razorpayLinkedAccountStatus || "").trim().toLowerCase();
  const productStatus = String(shop?.razorpayProductStatus || "").trim().toLowerCase();

  if (!linkedAccountId) {
    return false;
  }

  const isLinkedAccountActive =
    !linkedAccountStatus || linkedAccountStatus === "activated" || linkedAccountStatus === "active";

  return isLinkedAccountActive && productStatus === "activated";
}

export function getShopPaymentUnavailableMessage() {
  return "Online payment is disabled for this shop until Razorpay Route payout onboarding is fully activated. This can take about 7 days.";
}
