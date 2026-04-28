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

export function getRouteOnboardingState(shop?: Shop | null): RouteOnboardingState {
  const approvalStatus = shop?.approvalStatus || "";
  const linkedAccountStatus = normalizeStatus(shop?.razorpayLinkedAccountStatus);
  const hasLinkedAccount = Boolean(shop?.razorpayLinkedAccountId);
  const onlinePaymentsEnabled = Boolean(shop?.onlinePaymentsEnabled);
  const adminVerifiedRazorpayAccount = Boolean(shop?.adminVerifiedRazorpayAccount);
  const isPaymentsReady = canShopReceiveOnlinePayments(shop);
  const requirements: string[] = [];
  const ownerPanStatus = String(shop?.pendingOwnerPan || "").trim()
    ? "Submitted"
    : "Not submitted";
  const bankVerificationStatus = shop?.bankAccountLast4
    ? `Submitted - xxxx${shop.bankAccountLast4}`
    : "Not submitted";
  const routeTermsStatus = shop?.pendingRouteTermsAccepted ? "Accepted" : "Pending";
  const paymentBlockedReason = getShopPaymentBlockedReason(shop);
  const showCorrectionScreen = false;

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
            : "Waiting for admin approval before manual payout setup begins.",
    },
    {
      label: "Linked account",
      status: hasLinkedAccount ? "done" : approvalStatus === "approved" ? "current" : "pending",
      detail: hasLinkedAccount
        ? `Linked account status: ${shop?.razorpayLinkedAccountStatus || "created"}.`
        : "Admin has not saved a verified linked account id yet.",
    },
    {
      label: "Verification",
      status: adminVerifiedRazorpayAccount
        ? "done"
        : hasLinkedAccount && approvalStatus === "approved"
          ? "current"
          : "pending",
      detail: adminVerifiedRazorpayAccount
        ? "Admin confirmed in Razorpay Dashboard that this linked account is activated/verified."
        : hasLinkedAccount
          ? "Waiting for admin payment verification in Razorpay Dashboard."
          : "Admin must create the linked account manually in Razorpay Dashboard and paste the acc_xxx here.",
    },
    {
      label: "Online payments",
      status: isPaymentsReady ? "done" : onlinePaymentsEnabled ? "current" : "pending",
      detail: onlinePaymentsEnabled
        ? adminVerifiedRazorpayAccount
          ? "Online payments are enabled for checkout."
          : "Online payments are toggled on, but admin payment verification is still required."
        : "Online payments are still off until an admin turns them on.",
    },
  ];

  if (isPaymentsReady) {
    return {
      tone: "success",
      title: "Online payments are active",
      description:
        "Your shop is approved, a linked account has been saved, and online payments are enabled. Customers can now pay online.",
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
          ? "Update your shop details and resubmit them before manual onboarding can continue."
          : "The shop is waiting for admin approval. After approval, admins will create the linked account manually in Razorpay Dashboard.",
      steps,
      requirements,
      paymentBlockedReason,
      ownerPanStatus,
      bankVerificationStatus,
      routeTermsStatus,
      showCorrectionScreen: false,
    };
  }

  if (linkedAccountStatus === "under_review") {
    return {
      tone: "warning",
      title: "Linked account is under review",
      description:
        "Online payments stay blocked while Razorpay reviews the linked account that was created manually in the dashboard.",
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
    title: "Waiting for admin payment verification",
    description:
      "The shop cannot receive new customer orders until an admin confirms the linked account is activated/verified in Razorpay Dashboard and turns online payments on.",
    steps,
    requirements,
    paymentBlockedReason,
    ownerPanStatus,
    bankVerificationStatus,
    routeTermsStatus,
    showCorrectionScreen,
  };
}
