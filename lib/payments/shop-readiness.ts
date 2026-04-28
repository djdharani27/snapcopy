import type { Shop } from "@/types";

export function canShopReceiveOnlinePayments(
  shop?:
    | Pick<
        Shop,
        | "approvalStatus"
        | "onlinePaymentsEnabled"
        | "adminVerifiedRazorpayAccount"
        | "razorpayLinkedAccountId"
        | "razorpayLinkedAccountStatus"
        | "paymentBlockedReason"
      >
    | null,
) {
  if (!shop || shop.approvalStatus !== "approved") {
    return false;
  }

  const linkedAccountId = String(shop?.razorpayLinkedAccountId || "").trim();
  const onlinePaymentsEnabled = Boolean(shop?.onlinePaymentsEnabled);
  const adminVerifiedRazorpayAccount = Boolean(shop?.adminVerifiedRazorpayAccount);

  if (!linkedAccountId || !onlinePaymentsEnabled || !adminVerifiedRazorpayAccount) {
    return false;
  }

  return true;
}

export function getShopPaymentBlockedReason(shop?: Shop | null) {
  if (!shop) {
    return "Shop is missing.";
  }

  if (shop.approvalStatus !== "approved") {
    return "Shop approval is pending.";
  }

  if (!String(shop.settlementEmail || "").trim()) {
    return "Settlement email is required before manual Razorpay onboarding can continue.";
  }

  if (!shop.razorpayLinkedAccountId) {
    return "Verified Razorpay linked account id has not been saved yet.";
  }

  if (!shop.onlinePaymentsEnabled) {
    return "Online payments are still turned off by admin.";
  }

  if (!shop.adminVerifiedRazorpayAccount) {
    return "Waiting for admin payment verification.";
  }

  if (String(shop.paymentBlockedReason || "").trim()) {
    return String(shop.paymentBlockedReason || "").trim();
  }

  return "Manual Razorpay onboarding is incomplete.";
}

export function getShopPaymentUnavailableMessage(shop?: Shop | null) {
  const reason = getShopPaymentBlockedReason(shop);
  return `This shop cannot accept new online print orders until manual Razorpay onboarding is completed. ${reason}`;
}
