import type { Shop } from "@/types";

function getNormalizedLinkedAccountStatus(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function canShopReceiveOnlinePayments(
  shop?:
    | Pick<
        Shop,
        | "approvalStatus"
        | "onlinePaymentsEnabled"
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
  const linkedAccountStatus = getNormalizedLinkedAccountStatus(shop?.razorpayLinkedAccountStatus);
  const onlinePaymentsEnabled = Boolean(shop?.onlinePaymentsEnabled);

  if (!linkedAccountId || !onlinePaymentsEnabled) {
    return false;
  }

  if (linkedAccountStatus === "suspended") {
    return false;
  }

  return !String(shop?.paymentBlockedReason || "").trim();
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

  const accountReason = String(shop.razorpayLinkedAccountStatusReason || "").trim();
  const accountDescription = String(shop.razorpayLinkedAccountStatusDescription || "").trim();

  if (accountReason || accountDescription) {
    return [accountReason, accountDescription].filter(Boolean).join(" - ");
  }

  if (
    shop.razorpayLinkedAccountStatus &&
    getNormalizedLinkedAccountStatus(shop.razorpayLinkedAccountStatus) === "suspended"
  ) {
    return `Linked account status is ${shop.razorpayLinkedAccountStatus}.`;
  }

  if (!shop.onlinePaymentsEnabled) {
    return "Online payments are still turned off by admin.";
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
