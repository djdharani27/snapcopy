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
  return "This shop can continue accepting orders and serving customers. Online payment is temporarily unavailable until Razorpay Route payout onboarding is fully activated. Customers can pay the shop offline until then.";
}
