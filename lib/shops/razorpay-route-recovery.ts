export const LINKED_ACCOUNT_RECOVERY_FAILED_STEP = "linked_account_recovery_failed";
export const LINKED_ACCOUNT_RECOVERY_FAILED_MESSAGE =
  "Recovered Razorpay account is not accessible with current API keys. Check test/live mode or duplicate account from another Razorpay account.";

export class LinkedAccountRecoveryFailedError extends Error {
  recoveredAccountId: string;
  onboardingStep: string;
  onboardingError: string;
  verificationResult: string;
  razorpayKeyMode: "test" | "live" | "unknown";

  constructor(params: {
    recoveredAccountId: string;
    verificationResult: string;
    razorpayKeyMode: "test" | "live" | "unknown";
  }) {
    super(LINKED_ACCOUNT_RECOVERY_FAILED_MESSAGE);
    this.name = "LinkedAccountRecoveryFailedError";
    this.recoveredAccountId = params.recoveredAccountId;
    this.onboardingStep = LINKED_ACCOUNT_RECOVERY_FAILED_STEP;
    this.onboardingError = LINKED_ACCOUNT_RECOVERY_FAILED_MESSAGE;
    this.verificationResult = params.verificationResult;
    this.razorpayKeyMode = params.razorpayKeyMode;
  }
}

export function extractExistingLinkedAccountId(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");

  const fullAccountMatch = message.match(/\b(acc_[A-Za-z0-9]+)\b/i);
  if (fullAccountMatch?.[1]) {
    return fullAccountMatch[1];
  }

  const accountSuffixMatch = message.match(/account\s*-\s*([A-Za-z0-9]+)/i);
  if (accountSuffixMatch?.[1]) {
    return `acc_${accountSuffixMatch[1]}`;
  }

  return "";
}

function parseRecoveredLinkedAccountId(value: unknown) {
  const trimmedValue = String(value || "").trim();

  if (!/^acc_[A-Za-z0-9]+$/.test(trimmedValue)) {
    throw new Error("Enter a valid Razorpay linked account id.");
  }

  return trimmedValue;
}

export function getRazorpayKeyMode(keyId?: string | null) {
  const normalizedKeyId = String(keyId || "").trim();

  if (normalizedKeyId.startsWith("rzp_test_")) {
    return "test" as const;
  }

  if (normalizedKeyId.startsWith("rzp_live_")) {
    return "live" as const;
  }

  return "unknown" as const;
}

export function buildLinkedAccountRecoveryFailureUpdate(errorMessage: string) {
  return {
    razorpayLinkedAccountId: "",
    razorpayLinkedAccountStatus: "recovery_failed",
    razorpayLinkedAccountStatusReason: "access_denied",
    razorpayLinkedAccountStatusDescription: errorMessage,
    razorpayStakeholderId: "",
    razorpayProductId: "",
    razorpayProductStatus: "",
    razorpayProductResolutionUrl: "",
    razorpayProductRequirements: [],
    razorpayOwnerPanStatus: "",
    razorpayBankVerificationStatus: "",
    paymentBlockedReason: errorMessage,
    isActive: false,
    onboardingStep: LINKED_ACCOUNT_RECOVERY_FAILED_STEP,
    onboardingError: errorMessage,
  };
}

export async function recoverVerifiedLinkedAccount(params: {
  error: unknown;
  verifyLinkedAccount: (accountId: string) => Promise<{
    id: string;
    type: "route";
    status: string;
    email: string;
    phone: string | number;
    reference_id?: string;
    status_details?: {
      reason?: string;
      description?: string;
    };
  }>;
  razorpayKeyId?: string | null;
}) {
  const recoveredAccountId = extractExistingLinkedAccountId(params.error);

  if (!recoveredAccountId) {
    return null;
  }

  const parsedAccountId = parseRecoveredLinkedAccountId(recoveredAccountId);
  const razorpayKeyMode = getRazorpayKeyMode(params.razorpayKeyId);

  console.info("[Razorpay Route Recovery] Recovered linked account candidate", {
    recovered_account_id: parsedAccountId,
    razorpay_key_mode: razorpayKeyMode,
  });

  try {
    const linkedAccount = await params.verifyLinkedAccount(parsedAccountId);

    console.info("[Razorpay Route Recovery] Linked account verification result", {
      recovered_account_id: parsedAccountId,
      razorpay_key_mode: razorpayKeyMode,
      get_verification_result: "verified",
    });

    return {
      status: "verified" as const,
      recoveredAccountId: parsedAccountId,
      razorpayKeyMode,
      linkedAccount,
    };
  } catch (error) {
    const verificationResult = error instanceof Error ? error.message : String(error || "");

    console.warn("[Razorpay Route Recovery] Linked account verification result", {
      recovered_account_id: parsedAccountId,
      razorpay_key_mode: razorpayKeyMode,
      get_verification_result: verificationResult,
    });

    if (verificationResult.toLowerCase().includes("access denied")) {
      return {
        status: "verification_failed" as const,
        recoveredAccountId: parsedAccountId,
        razorpayKeyMode,
        verificationResult,
        failureUpdate: buildLinkedAccountRecoveryFailureUpdate(
          LINKED_ACCOUNT_RECOVERY_FAILED_MESSAGE,
        ),
      };
    }

    throw error;
  }
}
