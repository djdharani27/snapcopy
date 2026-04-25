import {
  getUserProfileById,
  resetShopRouteOnboarding,
  updateShopApproval,
  updateShopRouteDetails,
} from "@/lib/firebase/firestore-admin";
import {
  createRazorpayLinkedAccount,
  createRazorpayStakeholder,
  fetchAllRazorpayStakeholders,
  fetchRazorpayLinkedAccount,
  fetchRazorpayRouteProductConfiguration,
  fetchRazorpayStakeholder,
  requestRazorpayRouteProductConfiguration,
  updateRazorpayLinkedAccount,
  updateRazorpayRouteProductConfiguration,
} from "@/lib/payments/razorpay";
import { getRouteResolutionUrl } from "@/lib/payments/route-webhook-state";
import {
  maskBankAccount,
  parseAcceptedTerms,
  parseBankAccountNumber,
  parseIfsc,
  parsePan,
  parseRequiredText,
  parseRazorpayLinkedAccountId,
} from "@/lib/shops/validation";
import {
  buildLinkedAccountRecoveryFailureUpdate,
  LinkedAccountRecoveryFailedError,
} from "@/lib/shops/razorpay-route-recovery";
import type { Shop } from "@/types";

type RazorpayRequirement = NonNullable<Shop["razorpayProductRequirements"]>[number];

function buildRazorpayReferenceId(shop: Shop) {
  return shop.id;
}

function extractExistingStakeholderId(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const match = message.match(/(sth_[A-Za-z0-9]+)/i);
  return match?.[1] || "";
}

function extractExistingProductId(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const match = message.match(/(acc_prd_[A-Za-z0-9]+)/i);
  return match?.[1] || "";
}

function isDuplicateLinkedAccountReferenceError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const normalized = message.toLowerCase();
  return (
    normalized.includes("code is already in use") ||
    normalized.includes("reference") ||
    normalized.includes("merchant email already exists")
  );
}

const DUPLICATE_SETTLEMENT_EMAIL_ERROR =
  "This settlement email is already used in Razorpay. Use a different settlement email or manually attach a verified linked account ID.";

function isDuplicateStakeholderError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.toLowerCase().includes("stakeholders cannot be more than one");
}

function isAccessDeniedError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.toLowerCase().includes("access denied");
}

const STORED_LINKED_ACCOUNT_INACCESSIBLE_MESSAGE =
  "Stored linked account is inaccessible. Reset Route onboarding or attach a valid linked account.";

class StoredLinkedAccountInaccessibleError extends Error {
  constructor() {
    super(STORED_LINKED_ACCOUNT_INACCESSIBLE_MESSAGE);
    this.name = "StoredLinkedAccountInaccessibleError";
  }
}

function mapRazorpayRequirements(
  requirements?:
    | Array<{
        field_reference?: string;
        resolution_url?: string;
        reason_code?: string;
        status?: string;
      }>
    | null,
) {
  return (
    requirements?.map((requirement) => ({
      fieldReference: requirement.field_reference || "",
      resolutionUrl: requirement.resolution_url || "",
      reasonCode: requirement.reason_code || "",
      status: requirement.status || "",
    })) || []
  );
}

function getRequirementStatus(requirements: RazorpayRequirement[], patterns: string[]) {
  const match = requirements.find((requirement) => {
    const fieldReference = String(requirement.fieldReference || "").toLowerCase();
    return patterns.some((pattern) => fieldReference.includes(pattern));
  });

  if (!match) {
    return "No issue reported";
  }

  return [match.fieldReference, match.reasonCode, match.status].filter(Boolean).join(" - ");
}

function stringifyRoutePayload(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function getBlockingRequirementSummary(requirements: RazorpayRequirement[]) {
  const blockingRequirements = requirements.filter((requirement) => {
    const status = String(requirement.status || "").trim().toLowerCase();
    return !["resolved", "completed", "approved", "verified"].includes(status);
  });

  return blockingRequirements
    .map((requirement) =>
      [requirement.fieldReference, requirement.reasonCode, requirement.status]
        .filter(Boolean)
        .join(" - "),
    )
    .filter(Boolean)
    .join("; ");
}

function buildPaymentBlockedReason(params: {
  stakeholderId: string;
  productId: string;
  linkedAccountStatusReason?: string;
  linkedAccountStatusDescription?: string;
  productStatus?: string;
  productRequirements: RazorpayRequirement[];
  extraReason?: string;
}) {
  const reasons = [
    String(params.linkedAccountStatusReason || "").trim(),
    String(params.linkedAccountStatusDescription || "").trim(),
    !params.stakeholderId ? "Razorpay stakeholder has not been created yet." : "",
    !params.productId ? "Razorpay Route product has not been created yet." : "",
    params.productStatus && params.productStatus !== "activated"
      ? `Route product status is ${params.productStatus}.`
      : "",
    getBlockingRequirementSummary(params.productRequirements)
      ? `Route requirements pending: ${getBlockingRequirementSummary(params.productRequirements)}`
      : "",
    String(params.extraReason || "").trim(),
  ].filter(Boolean);

  return reasons.join(" ");
}

function getSavedRouteTermsAccepted(shop: Shop) {
  return Boolean(shop.pendingRouteTermsAccepted || shop.razorpayRouteTermsAccepted);
}

function getCurrentSettlementSnapshot(routeProduct: {
  requested_configuration?: unknown;
  active_configuration?: {
    settlements?: {
      account_number?: string;
      ifsc_code?: string;
      beneficiary_name?: string;
    };
  };
}) {
  const requestedConfiguration =
    routeProduct.requested_configuration &&
    typeof routeProduct.requested_configuration === "object"
      ? (routeProduct.requested_configuration as {
          settlements?: {
            account_number?: string;
            ifsc_code?: string;
            beneficiary_name?: string;
          };
        })
      : null;

  return requestedConfiguration?.settlements || routeProduct.active_configuration?.settlements || null;
}

function shouldPatchRouteProductConfiguration(params: {
  routeProduct: {
    active_configuration?: {
      settlements?: {
        account_number?: string;
        ifsc_code?: string;
        beneficiary_name?: string;
      };
    };
    requested_configuration?: unknown;
    tnc?: {
      accepted?: boolean;
    };
  };
  accountNumber: string;
  ifscCode: string;
  beneficiaryName: string;
  tncAccepted: boolean;
}) {
  const currentSettlements = getCurrentSettlementSnapshot(params.routeProduct);

  if (!currentSettlements) {
    return true;
  }

  return (
    String(currentSettlements.account_number || "").trim() !== params.accountNumber ||
    String(currentSettlements.ifsc_code || "").trim().toUpperCase() !== params.ifscCode ||
    String(currentSettlements.beneficiary_name || "").trim() !== params.beneficiaryName ||
    Boolean(params.routeProduct.tnc?.accepted) !== params.tncAccepted
  );
}

async function ensureRazorpayLinkedAccount(params: {
  shop: Shop;
  email: string;
  contactName: string;
  ownerPan: string;
  allowCreate: boolean;
}) {
  const existingLinkedAccountId = String(params.shop.razorpayLinkedAccountId || "").trim();

  if (!existingLinkedAccountId) {
    if (!params.allowCreate) {
      throw new Error("Razorpay linked account has not been created yet.");
    }

    try {
      return await createRazorpayLinkedAccount({
        email: params.email,
        phone: params.shop.phone,
        legalBusinessName: params.shop.shopName,
        contactName: params.contactName,
        referenceId: buildRazorpayReferenceId(params.shop),
        address: params.shop.address,
        city: params.shop.city || "",
        state: params.shop.state || "",
        postalCode: params.shop.postalCode || "",
        businessType: params.shop.businessType || "individual",
        description: params.shop.description || "Local print and copy shop",
        pan: params.ownerPan,
      });
    } catch (error) {
      if (!isDuplicateLinkedAccountReferenceError(error)) {
        throw error;
      }

      throw new Error(DUPLICATE_SETTLEMENT_EMAIL_ERROR);
    }
  }

  const accountId = parseRazorpayLinkedAccountId(existingLinkedAccountId);
  let linkedAccount;

  try {
    linkedAccount = await fetchRazorpayLinkedAccount(accountId);
  } catch (error) {
    if (isAccessDeniedError(error)) {
      await resetShopRouteOnboarding({
        shopId: params.shop.id,
        onboardingStep: "not_started",
        onboardingError: STORED_LINKED_ACCOUNT_INACCESSIBLE_MESSAGE,
        paymentBlockedReason: STORED_LINKED_ACCOUNT_INACCESSIBLE_MESSAGE,
      });
      throw new StoredLinkedAccountInaccessibleError();
    }

    throw error;
  }

  return updateRazorpayLinkedAccount({
    accountId,
    phone: params.shop.phone,
    legalBusinessName: params.shop.shopName,
    contactName: params.contactName,
    address: params.shop.address,
    city: params.shop.city || "",
    state: params.shop.state || "",
    postalCode: params.shop.postalCode || "",
    description: params.shop.description || "Local print and copy shop",
  }).catch((error) => {
    console.error("Razorpay linked account update failed during onboarding sync", {
      shopId: params.shop.id,
      accountId,
      error: error instanceof Error ? error.message : String(error),
    });
    return linkedAccount;
  });
}

async function ensureRazorpayStakeholder(params: {
  accountId: string;
  stakeholderId?: string;
  name: string;
  email: string;
  phone: string;
  pan: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
}) {
  const existingStakeholderId = String(params.stakeholderId || "").trim();

  if (existingStakeholderId) {
    try {
      return await fetchRazorpayStakeholder({
        accountId: params.accountId,
        stakeholderId: existingStakeholderId,
      });
    } catch {
      // Continue into recovery logic when the stored stakeholder id is stale.
    }
  }

  try {
    return await createRazorpayStakeholder({
      accountId: params.accountId,
      name: params.name,
      email: params.email,
      phone: params.phone,
      pan: params.pan,
      address: params.address,
      city: params.city,
      state: params.state,
      postalCode: params.postalCode,
    });
  } catch (error) {
    const recoveredStakeholderId = extractExistingStakeholderId(error);

    if (recoveredStakeholderId) {
      return fetchRazorpayStakeholder({
        accountId: params.accountId,
        stakeholderId: recoveredStakeholderId,
      });
    }

    if (!isDuplicateStakeholderError(error)) {
      throw error;
    }

    const stakeholders = await fetchAllRazorpayStakeholders(params.accountId);
    const matchingStakeholder =
      stakeholders.items?.find((stakeholder) => {
        const stakeholderEmail = String(stakeholder.email || "").trim().toLowerCase();
        const stakeholderPan = String(stakeholder.kyc?.pan || "").trim().toUpperCase();

        return (
          stakeholderEmail === params.email.trim().toLowerCase() ||
          stakeholderPan === params.pan.trim().toUpperCase()
        );
      }) || stakeholders.items?.[0];

    if (!matchingStakeholder?.id) {
      throw new Error(
        "Razorpay reports that a stakeholder already exists for this linked account, but no stakeholder id could be recovered.",
      );
    }

    return fetchRazorpayStakeholder({
      accountId: params.accountId,
      stakeholderId: matchingStakeholder.id,
    });
  }
}

async function ensureRazorpayRouteProduct(params: {
  accountId: string;
  productId?: string;
  tncAccepted: boolean;
}) {
  const existingProductId = String(params.productId || "").trim();

  if (existingProductId) {
    try {
      return await fetchRazorpayRouteProductConfiguration({
        accountId: params.accountId,
        productId: existingProductId,
      });
    } catch {
      // Continue into recovery logic when the stored product id is stale.
    }
  }

  try {
    const routeProduct = await requestRazorpayRouteProductConfiguration({
      accountId: params.accountId,
      tncAccepted: params.tncAccepted,
    });

    return fetchRazorpayRouteProductConfiguration({
      accountId: params.accountId,
      productId: routeProduct.id,
    });
  } catch (error) {
    const recoveredProductId = extractExistingProductId(error);

    if (!recoveredProductId) {
      throw error;
    }

    return fetchRazorpayRouteProductConfiguration({
      accountId: params.accountId,
      productId: recoveredProductId,
    });
  }
}

async function runRazorpayRouteOnboarding(
  shop: Shop,
  options: {
    markApproved: boolean;
    allowCreateLinkedAccount: boolean;
  },
) {
  const profile = await getUserProfileById(shop.ownerId);
  if (!profile) {
    throw new Error("Shop owner profile is required before Razorpay onboarding can continue.");
  }
  const settlementEmail = parseRequiredText(
    shop.settlementEmail,
    "Settlement email",
  ).toLowerCase();

  const contactName = String(profile.name || shop.shopName || "").trim() || shop.shopName;
  const bankAccountHolderName = parseRequiredText(
    shop.bankAccountHolderName,
    "Bank account holder name",
  );
  const bankIfsc = parseIfsc(shop.bankIfsc);
  const hasPendingBankAccountNumber = Boolean(String(shop.pendingBankAccountNumber || "").trim());
  const parsedBankAccountNumber = hasPendingBankAccountNumber
    ? parseBankAccountNumber(shop.pendingBankAccountNumber)
    : "";
  const hasPendingOwnerPan = Boolean(String(shop.pendingOwnerPan || "").trim());
  const parsedOwnerPan = hasPendingOwnerPan ? parsePan(shop.pendingOwnerPan) : "";
  const routeTermsAccepted = parseAcceptedTerms(
    getSavedRouteTermsAccepted(shop),
    "Owner must accept the Razorpay Route terms before onboarding can continue.",
  );

  if (options.markApproved && !parsedOwnerPan) {
    throw new Error("Owner PAN is required before admin approval can complete Razorpay onboarding.");
  }

  if (options.markApproved && !parsedBankAccountNumber) {
    throw new Error(
      "Settlement bank account number is required before admin approval can complete Razorpay onboarding.",
    );
  }

  let linkedAccount;

  try {
    linkedAccount = await ensureRazorpayLinkedAccount({
      shop,
      email: settlementEmail,
      contactName,
      ownerPan: parsedOwnerPan,
      allowCreate: options.allowCreateLinkedAccount,
    });
  } catch (error) {
    if (error instanceof LinkedAccountRecoveryFailedError) {
      await updateShopRouteDetails({
        shopId: shop.id,
        ...buildLinkedAccountRecoveryFailureUpdate(error.onboardingError),
        bankAccountHolderName,
        bankIfsc,
        ...(parsedBankAccountNumber
          ? { bankAccountLast4: maskBankAccount(parsedBankAccountNumber) }
          : {}),
      });
    }

    throw error;
  }

  const linkedAccountId = parseRazorpayLinkedAccountId(linkedAccount.id);

  await updateShopRouteDetails({
    shopId: shop.id,
    razorpayLinkedAccountId: linkedAccountId,
    razorpayLinkedAccountStatus: linkedAccount.status,
    razorpayLinkedAccountStatusReason: linkedAccount.status_details?.reason || "",
    razorpayLinkedAccountStatusDescription: linkedAccount.status_details?.description || "",
    onboardingStep: "",
    onboardingError: "",
    bankAccountHolderName,
    bankIfsc,
    ...(parsedBankAccountNumber ? { bankAccountLast4: maskBankAccount(parsedBankAccountNumber) } : {}),
  });

  let stakeholderId = String(shop.razorpayStakeholderId || "").trim();
  let syncExtraReason = "";

  if (stakeholderId || parsedOwnerPan) {
    const stakeholder = await ensureRazorpayStakeholder({
      accountId: linkedAccountId,
      stakeholderId,
      name: bankAccountHolderName,
      email: settlementEmail,
      phone: shop.phone,
      pan: parsedOwnerPan,
      address: shop.address,
      city: shop.city || "",
      state: shop.state || "",
      postalCode: shop.postalCode || "",
    });

    stakeholderId = String(stakeholder.id || "").trim();

    await updateShopRouteDetails({
      shopId: shop.id,
      razorpayLinkedAccountId: linkedAccountId,
      razorpayStakeholderId: stakeholderId,
    });
  } else {
    syncExtraReason = "Owner PAN is required before the Razorpay stakeholder can be created.";
  }

  let routeProductId = String(shop.razorpayProductId || "").trim();
  let routeProductRequirements: RazorpayRequirement[] = [];
  let routeProductStatus = String(shop.razorpayProductStatus || "").trim();
  let routeTermsAcceptedAtRazorpay = Boolean(shop.razorpayRouteTermsAccepted);
  let routeRawResponseJson = "";

  if (stakeholderId) {
    const routeProduct = await ensureRazorpayRouteProduct({
      accountId: linkedAccountId,
      productId: routeProductId,
      tncAccepted: routeTermsAccepted,
    });

    routeProductId = String(routeProduct.id || "").trim();
    routeProductStatus = String(routeProduct.activation_status || "").trim();
    routeTermsAcceptedAtRazorpay = Boolean(routeProduct.tnc?.accepted ?? routeTermsAccepted);

    if (parsedBankAccountNumber) {
      const needsProductPatch = shouldPatchRouteProductConfiguration({
        routeProduct,
        accountNumber: parsedBankAccountNumber,
        ifscCode: bankIfsc,
        beneficiaryName: bankAccountHolderName,
        tncAccepted: routeTermsAccepted,
      });

      const syncedRouteProduct = needsProductPatch
        ? await updateRazorpayRouteProductConfiguration({
            accountId: linkedAccountId,
            productId: routeProductId,
            accountNumber: parsedBankAccountNumber,
            ifscCode: bankIfsc,
            beneficiaryName: bankAccountHolderName,
            tncAccepted: routeTermsAccepted,
          })
        : routeProduct;

      routeRawResponseJson = stringifyRoutePayload(syncedRouteProduct);
      routeProductRequirements = mapRazorpayRequirements(syncedRouteProduct.requirements);
      routeProductStatus = String(syncedRouteProduct.activation_status || "").trim();
      routeTermsAcceptedAtRazorpay = Boolean(
        syncedRouteProduct.tnc?.accepted ?? routeTermsAccepted,
      );
    } else {
      routeRawResponseJson = stringifyRoutePayload(routeProduct);
      routeProductRequirements = mapRazorpayRequirements(routeProduct.requirements);
      syncExtraReason = syncExtraReason
        ? `${syncExtraReason} Re-enter the settlement bank account number to submit Razorpay Route product configuration updates.`
        : "Re-enter the settlement bank account number to submit Razorpay Route product configuration updates.";
    }
  }

  const paymentBlockedReason = buildPaymentBlockedReason({
    stakeholderId,
    productId: routeProductId,
    linkedAccountStatusReason: linkedAccount.status_details?.reason || "",
    linkedAccountStatusDescription: linkedAccount.status_details?.description || "",
    productStatus: routeProductStatus,
    productRequirements: routeProductRequirements,
    extraReason: syncExtraReason,
  });

  const shopRouteUpdate = {
    shopId: shop.id,
    razorpayLinkedAccountId: linkedAccountId,
    razorpayLinkedAccountStatus: linkedAccount.status,
    razorpayLinkedAccountStatusReason: linkedAccount.status_details?.reason || "",
    razorpayLinkedAccountStatusDescription: linkedAccount.status_details?.description || "",
    razorpayStakeholderId: stakeholderId,
    razorpayProductId: routeProductId,
    razorpayProductStatus: routeProductStatus,
    razorpayProductResolutionUrl: getRouteResolutionUrl(routeProductRequirements),
    razorpayProductRequirements: routeProductRequirements,
    routeActivationStatus: routeProductStatus,
    routeRequirementsJson: stringifyRoutePayload(routeProductRequirements),
    routeRawResponseJson,
    razorpayOwnerPanStatus: getRequirementStatus(routeProductRequirements, ["pan"]),
    razorpayBankVerificationStatus: getRequirementStatus(routeProductRequirements, [
      "settlements.account_number",
      "settlements.ifsc_code",
      "settlements.beneficiary_name",
      "account_number",
      "ifsc",
      "beneficiary",
    ]),
    razorpayRouteTermsAccepted: routeTermsAcceptedAtRazorpay,
    paymentBlockedReason,
    isActive:
      !paymentBlockedReason &&
      Boolean(linkedAccountId) &&
      Boolean(stakeholderId) &&
      Boolean(routeProductId) &&
      routeProductStatus === "activated",
    bankAccountHolderName,
    bankIfsc,
    ...(parsedBankAccountNumber ? { bankAccountLast4: maskBankAccount(parsedBankAccountNumber) } : {}),
  };

  return options.markApproved
    ? updateShopApproval({
        ...shopRouteUpdate,
        approvalStatus: "approved",
      })
    : updateShopRouteDetails(shopRouteUpdate);
}

export async function approveShopAndRunRouteOnboarding(shop: Shop) {
  return runRazorpayRouteOnboarding(shop, {
    markApproved: true,
    allowCreateLinkedAccount: true,
  });
}

export async function syncShopRazorpayStatus(shop: Shop) {
  const linkedAccountId = String(shop.razorpayLinkedAccountId || "").trim();
  const routeProductId = String(shop.razorpayProductId || "").trim();

  if (!linkedAccountId || !routeProductId) {
    throw new Error("Linked account and Route product are required before status sync can continue.");
  }

  const routeProduct = await fetchRazorpayRouteProductConfiguration({
    accountId: linkedAccountId,
    productId: routeProductId,
  });

  const routeProductRequirements = mapRazorpayRequirements(routeProduct.requirements);
  const routeProductStatus = String(routeProduct.activation_status || "").trim();
  const routeTermsAcceptedAtRazorpay = Boolean(
    routeProduct.tnc?.accepted ?? shop.razorpayRouteTermsAccepted,
  );
  const paymentBlockedReason = buildPaymentBlockedReason({
    stakeholderId: String(shop.razorpayStakeholderId || "").trim(),
    productId: routeProductId,
    linkedAccountStatusReason: String(shop.razorpayLinkedAccountStatusReason || "").trim(),
    linkedAccountStatusDescription: String(shop.razorpayLinkedAccountStatusDescription || "").trim(),
    productStatus: routeProductStatus,
    productRequirements: routeProductRequirements,
    extraReason: "",
  });

  return updateShopRouteDetails({
    shopId: shop.id,
    razorpayProductId: routeProductId,
    razorpayProductStatus: routeProductStatus,
    razorpayProductResolutionUrl: getRouteResolutionUrl(routeProductRequirements),
    razorpayProductRequirements: routeProductRequirements,
    routeActivationStatus: routeProductStatus,
    routeRequirementsJson: stringifyRoutePayload(routeProductRequirements),
    routeRawResponseJson: stringifyRoutePayload(routeProduct),
    razorpayOwnerPanStatus: getRequirementStatus(routeProductRequirements, ["pan"]),
    razorpayBankVerificationStatus: getRequirementStatus(routeProductRequirements, [
      "settlements.account_number",
      "settlements.ifsc_code",
      "settlements.beneficiary_name",
      "account_number",
      "ifsc",
      "beneficiary",
    ]),
    razorpayRouteTermsAccepted: routeTermsAcceptedAtRazorpay,
    paymentBlockedReason,
    isActive:
      !paymentBlockedReason &&
      Boolean(linkedAccountId) &&
      Boolean(String(shop.razorpayStakeholderId || "").trim()) &&
      Boolean(routeProductId) &&
      routeProductStatus === "activated",
  });
}
