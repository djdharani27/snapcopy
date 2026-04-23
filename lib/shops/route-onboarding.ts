import { getUserProfileById, updateShopApproval } from "@/lib/firebase/firestore-admin";
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
    : await createRazorpayLinkedAccount({
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

  return updateShopApproval({
    shopId: shop.id,
    approvalStatus: "approved",
    razorpayLinkedAccountId,
    razorpayLinkedAccountStatus: linkedAccount.status,
    razorpayStakeholderId: stakeholderId,
    razorpayProductId: updatedRouteProduct.id,
    razorpayProductStatus: updatedRouteProduct.activation_status,
    bankAccountHolderName: parsedBankAccountHolderName,
    bankIfsc: parsedBankIfsc,
    bankAccountLast4: maskBankAccount(parsedBankAccountNumber),
  });
}
