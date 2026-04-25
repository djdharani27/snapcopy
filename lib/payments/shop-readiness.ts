import type { Shop } from "@/types";

function getNormalizedLinkedAccountStatus(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function getNormalizedProductStatus(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function getBlockingRequirementSummary(
  requirements?: Shop["razorpayProductRequirements"],
) {
  if (!Array.isArray(requirements) || requirements.length === 0) {
    return "";
  }

  const blockingRequirements = requirements.filter((requirement) => {
    const status = String(requirement?.status || "").trim().toLowerCase();
    return !["resolved", "completed", "approved", "verified"].includes(status);
  });

  if (blockingRequirements.length === 0) {
    return "";
  }

  return blockingRequirements
    .map((requirement) =>
      [
        String(requirement?.fieldReference || "").trim(),
        String(requirement?.reasonCode || "").trim(),
        String(requirement?.status || "").trim(),
      ]
        .filter(Boolean)
        .join(" - "),
    )
    .filter(Boolean)
    .join("; ");
}

export function canShopReceiveOnlinePayments(
  shop?:
    | Pick<
        Shop,
        | "approvalStatus"
        | "razorpayLinkedAccountId"
        | "razorpayStakeholderId"
        | "razorpayProductId"
        | "razorpayLinkedAccountStatus"
        | "razorpayProductStatus"
        | "razorpayProductRequirements"
        | "paymentBlockedReason"
      >
    | null,
) {
  if (!shop || shop.approvalStatus !== "approved") {
    return false;
  }

  const linkedAccountId = String(shop?.razorpayLinkedAccountId || "").trim();
  const stakeholderId = String(shop?.razorpayStakeholderId || "").trim();
  const productId = String(shop?.razorpayProductId || "").trim();
  const linkedAccountStatus = getNormalizedLinkedAccountStatus(shop?.razorpayLinkedAccountStatus);
  const productStatus = getNormalizedProductStatus(shop?.razorpayProductStatus);
  const blockingRequirements = getBlockingRequirementSummary(shop?.razorpayProductRequirements);

  if (!linkedAccountId || !stakeholderId || !productId) {
    return false;
  }

  if (linkedAccountStatus === "suspended") {
    return false;
  }

  if (productStatus !== "activated") {
    return false;
  }

  if (blockingRequirements) {
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
    return "Settlement email is required before Razorpay Route onboarding can continue.";
  }

  if (!shop.razorpayLinkedAccountId) {
    return "Razorpay linked account has not been created yet.";
  }

  if (!shop.razorpayStakeholderId) {
    return "Razorpay stakeholder has not been created yet.";
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

  if (!shop.razorpayProductId) {
    return "Razorpay Route product has not been created yet.";
  }

  if (shop.razorpayProductStatus && getNormalizedProductStatus(shop.razorpayProductStatus) !== "activated") {
    return `Route product status is ${shop.razorpayProductStatus}.`;
  }

  const blockingRequirements = getBlockingRequirementSummary(shop.razorpayProductRequirements);
  if (blockingRequirements) {
    return `Route requirements pending: ${blockingRequirements}`;
  }

  if (String(shop.paymentBlockedReason || "").trim()) {
    return String(shop.paymentBlockedReason || "").trim();
  }

  return "Razorpay Route setup is not activated yet.";
}

export function getShopPaymentUnavailableMessage(shop?: Shop | null) {
  const reason = getShopPaymentBlockedReason(shop);
  return `This shop cannot accept new online print orders until Razorpay Route onboarding is fully activated. ${reason}`;
}
