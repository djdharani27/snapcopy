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

export function getShopPaymentBlockedReason(shop?: Shop | null) {
  if (!shop) {
    return "Shop is missing.";
  }

  if (shop.approvalStatus !== "approved") {
    return "Shop approval is pending.";
  }

  if (!shop.razorpayLinkedAccountId) {
    return "Admin has not added the Razorpay linked account yet.";
  }

  const accountReason = String(shop.razorpayLinkedAccountStatusReason || "").trim();
  const accountDescription = String(shop.razorpayLinkedAccountStatusDescription || "").trim();

  if (accountReason || accountDescription) {
    return [accountReason, accountDescription].filter(Boolean).join(" - ");
  }

  if (!shop.razorpayProductId) {
    return "Admin has not added the Route product yet.";
  }

  if (shop.razorpayProductStatus && shop.razorpayProductStatus !== "activated") {
    return `Route product status is ${shop.razorpayProductStatus}.`;
  }

  if (
    shop.razorpayLinkedAccountStatus &&
    !["active", "activated"].includes(shop.razorpayLinkedAccountStatus.toLowerCase())
  ) {
    return `Linked account status is ${shop.razorpayLinkedAccountStatus}.`;
  }

  return "Manual Razorpay Route setup is not activated yet.";
}

export function getShopPaymentUnavailableMessage(shop?: Shop | null) {
  const reason = getShopPaymentBlockedReason(shop);
  return `This shop can continue accepting orders and serving customers. Online payment is temporarily unavailable until the admin-managed Razorpay Route payout setup is fully activated. ${reason}`;
}
