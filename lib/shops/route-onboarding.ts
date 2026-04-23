import { getUserProfileById, updateShopApproval } from "@/lib/firebase/firestore-admin";
import {
  createRazorpayLinkedAccount,
  createRazorpayStakeholder,
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

  const linkedAccount = await createRazorpayLinkedAccount({
    email: profile.email,
    phone: shop.phone,
    legalBusinessName: shop.shopName,
    contactName: profile.name || shop.shopName,
    referenceId: `shop_${shop.ownerId}`,
    address: shop.address,
    city: shop.city || "",
    state: shop.state || "",
    postalCode: shop.postalCode || "",
    description: shop.description || "Local print and copy shop",
  });

  const razorpayLinkedAccountId = parseRazorpayLinkedAccountId(linkedAccount.id);

  const stakeholder = await createRazorpayStakeholder({
    accountId: razorpayLinkedAccountId,
    name: parsedBankAccountHolderName,
    email: profile.email,
    phone: shop.phone,
    pan: parsedOwnerPan,
    address: shop.address,
    city: shop.city || "",
    state: shop.state || "",
    postalCode: shop.postalCode || "",
  });

  const routeProduct = await requestRazorpayRouteProductConfiguration({
    accountId: razorpayLinkedAccountId,
    tncAccepted: acceptedRouteTerms,
  });

  const updatedRouteProduct = await updateRazorpayRouteProductConfiguration({
    accountId: razorpayLinkedAccountId,
    productId: routeProduct.id,
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
    razorpayStakeholderId: stakeholder.id,
    razorpayProductId: updatedRouteProduct.id,
    razorpayProductStatus: updatedRouteProduct.activation_status,
    bankAccountHolderName: parsedBankAccountHolderName,
    bankIfsc: parsedBankIfsc,
    bankAccountLast4: maskBankAccount(parsedBankAccountNumber),
  });
}
