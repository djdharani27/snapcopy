import {
  getUserProfileById,
  updateShopApproval,
  updateShopRouteDetails,
} from "@/lib/firebase/firestore-admin";
import {
  createRazorpayLinkedAccount,
  createRazorpayStakeholder,
  fetchRazorpayLinkedAccount,
  requestRazorpayRouteProductConfiguration,
  updateRazorpayRouteProductConfiguration,
} from "@/lib/payments/razorpay";
import {
  maskBankAccount,
  parseAcceptedTerms,
  parseBankAccountNumber,
  parseIfsc,
  parsePan,
  parseRequiredText,
  parseRazorpayLinkedAccountId,
} from "@/lib/shops/validation";
import type { Shop } from "@/types";
import crypto from "crypto";

function buildRazorpayReferenceId(shop: Shop) {
  const digest = crypto.createHash("sha1").update(`${shop.id}:${shop.ownerId}`).digest("hex");
  return `shp_${digest.slice(0, 16)}`;
}

function extractExistingLinkedAccountId(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const match = message.match(/Merchant email already exists for account\s*-\s*(acc_[A-Za-z0-9]+)/i);
  return match?.[1] || "";
}

function getRequirementStatus(
  requirements: Array<{
    fieldReference?: string;
    resolutionUrl?: string;
    reasonCode?: string;
    status?: string;
  }>,
  patterns: string[],
) {
  const match = requirements.find((requirement) => {
    const fieldReference = String(requirement.fieldReference || "").toLowerCase();
    return patterns.some((pattern) => fieldReference.includes(pattern));
  });

  if (!match) {
    return "No issue reported";
  }

  return [match.fieldReference, match.reasonCode, match.status].filter(Boolean).join(" - ");
}

export async function approveShopAndRunRouteOnboarding(shop: Shop) {
  const profile = await getUserProfileById(shop.ownerId);

  if (!profile?.email) {
    throw new Error("Shop owner profile email is required before approval.");
  }

  const parsedBankAccountHolderName = parseRequiredText(
    shop.bankAccountHolderName,
    "Bank account holder name",
  );
  const parsedBankIfsc = parseIfsc(shop.bankIfsc);
  const parsedBankAccountNumber = parseBankAccountNumber(shop.pendingBankAccountNumber);
  const parsedOwnerPan = parsePan(shop.pendingOwnerPan);
  const acceptedRouteTerms = parseAcceptedTerms(
    shop.pendingRouteTermsAccepted,
    "Owner must accept the Razorpay Route terms before approval.",
  );

  const existingLinkedAccountId = String(shop.razorpayLinkedAccountId || "").trim();
  const linkedAccount = existingLinkedAccountId
    ? await fetchRazorpayLinkedAccount(parseRazorpayLinkedAccountId(existingLinkedAccountId))
    : await (async () => {
        try {
          return await createRazorpayLinkedAccount({
            email: profile.email,
            phone: shop.phone,
            legalBusinessName: shop.shopName,
            contactName: profile.name || shop.shopName,
            referenceId: buildRazorpayReferenceId(shop),
            address: shop.address,
            city: shop.city || "",
            state: shop.state || "",
            postalCode: shop.postalCode || "",
            description: shop.description || "Local print and copy shop",
            pan: parsedOwnerPan,
          });
        } catch (error) {
          const recoveredLinkedAccountId = extractExistingLinkedAccountId(error);

          if (!recoveredLinkedAccountId) {
            throw error;
          }

          await updateShopRouteDetails({
            shopId: shop.id,
            razorpayLinkedAccountId: recoveredLinkedAccountId,
            paymentBlockedReason:
              "Recovered an existing Razorpay linked account from a duplicate-email response. Continuing manual Route setup.",
          });

          return fetchRazorpayLinkedAccount(
            parseRazorpayLinkedAccountId(recoveredLinkedAccountId),
          );
        }
      })();

  const razorpayLinkedAccountId = parseRazorpayLinkedAccountId(linkedAccount.id);
  const existingStakeholderId = String(shop.razorpayStakeholderId || "").trim();
  const existingRouteProductId = String(shop.razorpayProductId || "").trim();

  const stakeholderId =
    existingStakeholderId ||
    (
      await createRazorpayStakeholder({
        accountId: razorpayLinkedAccountId,
        name: parsedBankAccountHolderName,
        email: profile.email,
        phone: shop.phone,
        pan: parsedOwnerPan,
        address: shop.address,
        city: shop.city || "",
        state: shop.state || "",
        postalCode: shop.postalCode || "",
      })
    ).id;

  const routeProductId =
    existingRouteProductId ||
    (
      await requestRazorpayRouteProductConfiguration({
        accountId: razorpayLinkedAccountId,
        tncAccepted: acceptedRouteTerms,
      })
    ).id;

  const updatedRouteProduct = await updateRazorpayRouteProductConfiguration({
    accountId: razorpayLinkedAccountId,
    productId: routeProductId,
    accountNumber: parsedBankAccountNumber,
    ifscCode: parsedBankIfsc,
    beneficiaryName: parsedBankAccountHolderName,
    tncAccepted: acceptedRouteTerms,
  });
  const razorpayProductRequirements =
    updatedRouteProduct.requirements?.map((requirement) => ({
      fieldReference: requirement.field_reference || "",
      resolutionUrl: requirement.resolution_url || "",
      reasonCode: requirement.reason_code || "",
      status: requirement.status || "",
    })) || [];

  return updateShopApproval({
    shopId: shop.id,
    approvalStatus: "approved",
    razorpayLinkedAccountId,
    razorpayLinkedAccountStatus: linkedAccount.status,
    razorpayLinkedAccountStatusReason: linkedAccount.status_details?.reason || "",
    razorpayLinkedAccountStatusDescription: linkedAccount.status_details?.description || "",
    razorpayStakeholderId: stakeholderId,
    razorpayProductId: updatedRouteProduct.id,
    razorpayProductStatus: updatedRouteProduct.activation_status,
    razorpayProductRequirements,
    razorpayOwnerPanStatus: getRequirementStatus(razorpayProductRequirements, ["pan"]),
    razorpayBankVerificationStatus: getRequirementStatus(razorpayProductRequirements, [
      "settlements.account_number",
      "settlements.ifsc_code",
      "settlements.beneficiary_name",
      "account_number",
      "ifsc",
      "beneficiary",
    ]),
    razorpayRouteTermsAccepted: Boolean(updatedRouteProduct.tnc?.accepted),
    paymentBlockedReason: [
      linkedAccount.status_details?.reason || "",
      linkedAccount.status_details?.description || "",
      updatedRouteProduct.activation_status !== "activated"
        ? `Route product status is ${updatedRouteProduct.activation_status}.`
        : "",
    ]
      .filter(Boolean)
      .join(" "),
    bankAccountHolderName: parsedBankAccountHolderName,
    bankIfsc: parsedBankIfsc,
    bankAccountLast4: maskBankAccount(parsedBankAccountNumber),
  });
}
