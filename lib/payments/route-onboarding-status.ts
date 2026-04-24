import {
  canShopReceiveOnlinePayments,
  getShopPaymentBlockedReason,
} from "@/lib/payments/shop-readiness";
import type { Shop } from "@/types";

export interface RouteProgressStep {
  label: string;
  status: "done" | "current" | "pending";
  detail: string;
}

export interface RouteOnboardingState {
  tone: "success" | "warning" | "danger" | "neutral";
  title: string;
  description: string;
  steps: RouteProgressStep[];
  requirements: string[];
  paymentBlockedReason: string;
  ownerPanStatus: string;
  bankVerificationStatus: string;
  routeTermsStatus: string;
  showCorrectionScreen: boolean;
}

function normalizeStatus(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function formatRequirement(requirement: NonNullable<Shop["razorpayProductRequirements"]>[number]) {
  const fieldReference = String(requirement?.fieldReference || "").trim();
  const reasonCode = String(requirement?.reasonCode || "").trim().replace(/_/g, " ");
  const status = String(requirement?.status || "").trim();

  return [fieldReference, reasonCode, status].filter(Boolean).join(" - ");
}

function getRequirementStatus(
  requirements: NonNullable<Shop["razorpayProductRequirements"]>,
  patterns: string[],
) {
  const match = requirements.find((requirement) => {
    const fieldReference = String(requirement?.fieldReference || "").toLowerCase();
    return patterns.some((pattern) => fieldReference.includes(pattern));
  });

  if (!match) {
    return "No issue reported";
  }

  return formatRequirement(match);
}

export function getRouteOnboardingState(shop?: Shop | null): RouteOnboardingState {
  const approvalStatus = shop?.approvalStatus || "";
  const linkedAccountStatus = normalizeStatus(shop?.razorpayLinkedAccountStatus);
  const productStatus = normalizeStatus(shop?.razorpayProductStatus);
  const hasLinkedAccount = Boolean(shop?.razorpayLinkedAccountId);
  const hasStakeholder = Boolean(shop?.razorpayStakeholderId);
  const hasProduct = Boolean(shop?.razorpayProductId);
  const isPaymentsReady = canShopReceiveOnlinePayments(shop);
  const requirements =
    shop?.razorpayProductRequirements
      ?.map(formatRequirement)
      .filter(Boolean) || [];
  const ownerPanStatus =
    shop?.razorpayOwnerPanStatus ||
    getRequirementStatus(shop?.razorpayProductRequirements || [], ["pan"]);
  const bankVerificationStatus =
    shop?.razorpayBankVerificationStatus ||
    getRequirementStatus(shop?.razorpayProductRequirements || [], [
      "settlements.account_number",
      "settlements.ifsc_code",
      "settlements.beneficiary_name",
      "account_number",
      "ifsc",
      "beneficiary",
    ]);
  const routeTermsStatus = shop?.razorpayRouteTermsAccepted
    ? "Accepted"
    : getRequirementStatus(shop?.razorpayProductRequirements || [], ["tnc", "terms"]);
  const paymentBlockedReason = getShopPaymentBlockedReason(shop);
  const showCorrectionScreen =
    productStatus === "needs_clarification" ||
    linkedAccountStatus === "under_review" ||
    normalizeStatus(shop?.razorpayLinkedAccountStatusReason) === "rule_execution_failed";

  const steps: RouteProgressStep[] = [
    {
      label: "Approval",
      status:
        approvalStatus === "approved"
          ? "done"
          : approvalStatus === "rejected"
            ? "current"
            : "current",
      detail:
        approvalStatus === "approved"
          ? "Shop details were approved."
          : approvalStatus === "rejected"
            ? "Shop details were rejected and need resubmission."
            : "Waiting for admin approval before manual Route setup begins.",
    },
    {
      label: "Linked account",
      status: hasLinkedAccount ? "done" : approvalStatus === "approved" ? "current" : "pending",
      detail: hasLinkedAccount
        ? `Linked account status: ${shop?.razorpayLinkedAccountStatus || "created"}.`
        : "Linked account has not been created yet.",
    },
    {
      label: "Stakeholder",
      status: hasStakeholder ? "done" : hasLinkedAccount ? "current" : "pending",
      detail: hasStakeholder
        ? "Primary stakeholder has been recorded."
        : "Stakeholder/KYC step is still pending manual setup.",
    },
    {
      label: "Route product",
      status: isPaymentsReady ? "done" : hasProduct ? "current" : "pending",
      detail: hasProduct
        ? `Route product status: ${shop?.razorpayProductStatus || "requested"}.`
        : "Route product has not been added manually yet.",
    },
  ];

  if (isPaymentsReady) {
    return {
      tone: "success",
      title: "Online payments are active",
      description:
        "Your linked account, stakeholder, and Route product are fully activated. Customers can pay online and payouts can be routed automatically.",
      steps,
      requirements,
      paymentBlockedReason: "",
      ownerPanStatus,
      bankVerificationStatus,
      routeTermsStatus,
      showCorrectionScreen: false,
    };
  }

  if (approvalStatus !== "approved") {
    return {
      tone: approvalStatus === "rejected" ? "danger" : "warning",
      title:
        approvalStatus === "rejected"
          ? "Approval blocked"
          : "Waiting for admin approval",
      description:
        approvalStatus === "rejected"
          ? "Update your shop details and resubmit them before manual Route setup can continue."
          : "The shop is waiting for approval. Admins will complete the manual Route setup from the dashboard after approval.",
      steps,
      requirements,
      paymentBlockedReason,
      ownerPanStatus,
      bankVerificationStatus,
      routeTermsStatus,
      showCorrectionScreen: false,
    };
  }

  if (productStatus === "needs_clarification") {
    return {
      tone: "danger",
      title: "Razorpay needs clarification",
      description:
        "Online payments are blocked until the manual Route setup issues below are resolved and an admin updates the product status to activated.",
      steps,
      requirements,
      paymentBlockedReason,
      ownerPanStatus,
      bankVerificationStatus,
      routeTermsStatus,
      showCorrectionScreen,
    };
  }

  if (productStatus === "under_review" || linkedAccountStatus === "under_review") {
    return {
      tone: "warning",
      title: "Razorpay is reviewing the onboarding",
      description:
        "Online payments stay blocked while Razorpay reviews the manually entered linked account and Route product details.",
      steps,
      requirements,
      paymentBlockedReason,
      ownerPanStatus,
      bankVerificationStatus,
      routeTermsStatus,
      showCorrectionScreen,
    };
  }

  return {
    tone: "warning",
    title: "Online payments are not active yet",
    description:
      "The shop can still receive orders, but Razorpay payouts are not activated yet. Ask an admin to update the linked account and Route product details manually.",
    steps,
    requirements,
    paymentBlockedReason,
    ownerPanStatus,
    bankVerificationStatus,
    routeTermsStatus,
    showCorrectionScreen,
  };
}
