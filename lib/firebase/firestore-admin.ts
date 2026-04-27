import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  getNextSubscriptionExpiry,
  SHOP_SUBSCRIPTION_AMOUNT_PAISE,
} from "@/lib/payments/subscription-status";
import { getClientReturnVerificationPatch } from "@/lib/payments/client-payment-verification";
import { isTransferAttentionOrder } from "@/lib/payments/route-webhook-state";
import type {
  Order,
  OrderFile,
  OrderStatus,
  OrderWithFiles,
  Shop,
  ShopApprovalStatus,
  ShopSubscriptionPayment,
  UserProfile,
  UserRole,
} from "@/types";

function adminDb() {
  return getAdminDb();
}

function timestampToIso(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return null;
}

function normalizeGoogleMapsUrl(value: unknown) {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return "";
  }

  try {
    const url = new URL(rawValue);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return rawValue;
    }
  } catch {
    return "";
  }

  return "";
}

function isShopOnlinePaymentActive(shop?: Partial<Shop> | null) {
  if (!shop || shop.approvalStatus !== "approved") {
    return false;
  }

  const linkedAccountId = String(shop.razorpayLinkedAccountId || "").trim();
  const linkedAccountStatus = String(shop.razorpayLinkedAccountStatus || "").trim().toLowerCase();
  const onlinePaymentsEnabled = Boolean(shop.onlinePaymentsEnabled);

  if (!linkedAccountId || !onlinePaymentsEnabled) {
    return false;
  }

  if (linkedAccountStatus === "suspended") {
    return false;
  }

  return !String(shop.paymentBlockedReason || "").trim();
}

function mapDoc<T>(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    ...data,
    onboardingStep: String(data.onboardingStep ?? data.onboarding_step ?? ""),
    onboardingError: String(data.onboardingError ?? data.onboarding_error ?? ""),
    createdAt: timestampToIso(data.createdAt),
    approvalSubmittedAt: timestampToIso(data.approvalSubmittedAt),
    approvedAt: timestampToIso(data.approvedAt),
    rejectedAt: timestampToIso(data.rejectedAt),
    subscriptionValidUntil: timestampToIso(data.subscriptionValidUntil),
    paidAt: timestampToIso(data.paidAt),
    settlementPaidAt: timestampToIso(data.settlementPaidAt),
    downloadedAt: timestampToIso(data.downloadedAt),
    razorpayStatusLastSyncedAt: timestampToIso(data.razorpayStatusLastSyncedAt),
    transferUpdatedAt: timestampToIso(data.transferUpdatedAt),
    processedAt: timestampToIso(data.processedAt),
  } as T;
}

function normalizeShop(shop: Shop): Shop {
  return {
    ...shop,
    approvalStatus:
      shop.approvalStatus === "pending_approval" || shop.approvalStatus === "rejected"
        ? shop.approvalStatus
        : "approved",
    approvalSubmittedAt: shop.approvalSubmittedAt || null,
    approvedAt: shop.approvedAt || null,
    rejectedAt: shop.rejectedAt || null,
    city: String(shop.city || "").trim(),
    state: String(shop.state || "").trim(),
    postalCode: String(shop.postalCode || "").trim(),
    businessType: String(shop.businessType || "").trim() || "individual",
    googleMapsUrl: normalizeGoogleMapsUrl(
      (shop as Shop & { location?: string }).googleMapsUrl ||
        (shop as Shop & { location?: string }).location,
    ),
    services: Array.isArray(shop.services) ? shop.services : [],
    settlementEmail: String(shop.settlementEmail || "").trim().toLowerCase(),
    razorpayLinkedAccountId: String(shop.razorpayLinkedAccountId || "").trim(),
    razorpayLinkedAccountStatus: String(shop.razorpayLinkedAccountStatus || "").trim(),
    razorpayStakeholderId: String(shop.razorpayStakeholderId || "").trim(),
    razorpayProductId: String(shop.razorpayProductId || "").trim(),
    razorpayProductStatus: String(shop.razorpayProductStatus || "").trim(),
    razorpayProductResolutionUrl: String(shop.razorpayProductResolutionUrl || "").trim(),
    razorpayLinkedAccountStatusReason: String(shop.razorpayLinkedAccountStatusReason || "").trim(),
    razorpayLinkedAccountStatusDescription: String(shop.razorpayLinkedAccountStatusDescription || "").trim(),
    razorpayProductRequirements: Array.isArray(shop.razorpayProductRequirements)
      ? shop.razorpayProductRequirements.map((requirement) => ({
          fieldReference: String(requirement?.fieldReference || "").trim(),
          resolutionUrl: String(requirement?.resolutionUrl || "").trim(),
          reasonCode: String(requirement?.reasonCode || "").trim(),
          status: String(requirement?.status || "").trim(),
        }))
      : [],
    razorpayOwnerPanStatus: String(shop.razorpayOwnerPanStatus || "").trim(),
    razorpayBankVerificationStatus: String(shop.razorpayBankVerificationStatus || "").trim(),
    razorpayRouteTermsAccepted: Boolean(shop.razorpayRouteTermsAccepted),
    paymentBlockedReason: String(shop.paymentBlockedReason || "").trim(),
    razorpayStatusLastSyncedAt: shop.razorpayStatusLastSyncedAt || null,
    onboardingStep: String(shop.onboardingStep || "").trim(),
    onboardingError: String(shop.onboardingError || "").trim(),
    bankAccountHolderName: String(shop.bankAccountHolderName || "").trim(),
    bankIfsc: String(shop.bankIfsc || "").trim(),
    bankAccountLast4: String(shop.bankAccountLast4 || "").trim(),
    pendingBankAccountNumber: String(shop.pendingBankAccountNumber || "").trim(),
    pendingOwnerPan: String(shop.pendingOwnerPan || "").trim(),
    pendingRouteTermsAccepted: Boolean(shop.pendingRouteTermsAccepted),
    onlinePaymentsEnabled: Boolean(shop.onlinePaymentsEnabled),
    paymentOnboardingNote: String(shop.paymentOnboardingNote || "").trim(),
    subscriptionStatus:
      shop.subscriptionStatus === "active" || shop.subscriptionStatus === "expired"
        ? shop.subscriptionStatus
        : "inactive",
    subscriptionValidUntil: shop.subscriptionValidUntil || null,
    razorpaySubscriptionOrderId: String(shop.razorpaySubscriptionOrderId || "").trim() || null,
    razorpaySubscriptionPaymentId:
      String(shop.razorpaySubscriptionPaymentId || "").trim() || null,
    isActive: isShopOnlinePaymentActive(shop),
    pricing: {
      blackWhiteSingle: Number(shop.pricing?.blackWhiteSingle || 0),
      blackWhiteDouble: Number(shop.pricing?.blackWhiteDouble || 0),
      colorSingle: Number(shop.pricing?.colorSingle || 0),
      colorDouble: Number(shop.pricing?.colorDouble || 0),
    },
  };
}

function normalizeOrder(order: Order): Order {
  return {
    ...order,
    trackingCode: String(order.trackingCode || ""),
    pageCount:
      order.pageCount === null || order.pageCount === undefined ? null : Number(order.pageCount),
    printCostPaise:
      order.printCostPaise === null || order.printCostPaise === undefined
        ? null
        : Number(order.printCostPaise),
    platformFeePaise:
      order.platformFeePaise === null || order.platformFeePaise === undefined
        ? null
        : Number(order.platformFeePaise),
    totalAmountPaise:
      order.totalAmountPaise === null || order.totalAmountPaise === undefined
        ? null
        : Number(order.totalAmountPaise),
    shopEarningPaise:
      order.shopEarningPaise === null || order.shopEarningPaise === undefined
        ? null
        : Number(order.shopEarningPaise),
    platformEarningPaise:
      order.platformEarningPaise === null || order.platformEarningPaise === undefined
        ? null
        : Number(order.platformEarningPaise),
    paymentStatus: order.paymentStatus || "unpaid",
    paymentIntentStatus: order.paymentIntentStatus || "idle",
    paymentAttemptAmountPaise:
      order.paymentAttemptAmountPaise === null || order.paymentAttemptAmountPaise === undefined
        ? null
        : Number(order.paymentAttemptAmountPaise),
    razorpayOrderId: order.razorpayOrderId || null,
    razorpayPaymentId: order.razorpayPaymentId || null,
    platformCommissionPaise:
      order.platformCommissionPaise === null || order.platformCommissionPaise === undefined
        ? null
        : Number(order.platformCommissionPaise),
    platformTransactionFeePaise:
      order.platformTransactionFeePaise === null ||
      order.platformTransactionFeePaise === undefined
        ? order.platformCommissionPaise === null || order.platformCommissionPaise === undefined
          ? null
          : Number(order.platformCommissionPaise)
        : Number(order.platformTransactionFeePaise),
    estimatedFeePaise:
      order.estimatedFeePaise === null || order.estimatedFeePaise === undefined
        ? null
        : Number(order.estimatedFeePaise),
    estimatedTaxPaise:
      order.estimatedTaxPaise === null || order.estimatedTaxPaise === undefined
        ? null
        : Number(order.estimatedTaxPaise),
    gatewayFeeSource:
      order.gatewayFeeSource === "actual" || order.gatewayFeeSource === "estimated"
        ? order.gatewayFeeSource
        : null,
    transferableAmountPaise:
      order.transferableAmountPaise === null || order.transferableAmountPaise === undefined
        ? null
        : Number(order.transferableAmountPaise),
    transferId: order.transferId || null,
    transferStatus: order.transferStatus || "not_created",
    transferFailureReason: order.transferFailureReason || null,
    transferUpdatedAt: order.transferUpdatedAt || null,
    linkedAccountId: order.linkedAccountId || null,
    settlementStatus:
      order.settlementStatus === "paid" || order.settlementStatus === "failed"
        ? order.settlementStatus
        : order.settlementStatus === "pending"
          ? "pending"
          : null,
    settlementPaidAt: order.settlementPaidAt || null,
    refundId: order.refundId || null,
    refundedAmountPaise:
      order.refundedAmountPaise === null || order.refundedAmountPaise === undefined
        ? null
        : Number(order.refundedAmountPaise),
    paidAt: order.paidAt || null,
  };
}

function normalizeOrderFile(file: OrderFile): OrderFile {
  return {
    ...file,
    downloadedAt: file.downloadedAt || null,
    downloadedByOwnerId: file.downloadedByOwnerId || null,
  };
}

export async function getUserProfileById(uid: string) {
  const snapshot = await adminDb().collection("users").doc(uid).get();
  if (!snapshot.exists) return null;
  return mapDoc<UserProfile>(snapshot.id, snapshot.data() ?? {});
}

export async function upsertUserProfile(params: {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
}) {
  const ref = adminDb().collection("users").doc(params.uid);
  const snapshot = await ref.get();

  await ref.set(
    {
      uid: params.uid,
      name: params.name,
      email: params.email,
      role: params.role,
      ...(params.phone ? { phone: params.phone } : {}),
      createdAt: snapshot.exists ? snapshot.data()?.createdAt : FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return getUserProfileById(params.uid);
}

export async function getUsersByRole(role: UserRole) {
  const snapshot = await adminDb()
    .collection("users")
    .where("role", "==", role)
    .get();

  return snapshot.docs
    .map((doc) => mapDoc<UserProfile>(doc.id, doc.data() ?? {}))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAllShops(options?: { includeUnapproved?: boolean }) {
  const snapshot = await adminDb()
    .collection("shops")
    .orderBy("shopName", "asc")
    .get();

  const shops = snapshot.docs.map((doc) => normalizeShop(mapDoc<Shop>(doc.id, doc.data())));
  return options?.includeUnapproved
    ? shops
    : shops.filter((shop) => shop.approvalStatus === "approved" && Boolean(shop.isActive));
}

export async function getShopById(shopId: string, options?: { includeUnapproved?: boolean }) {
  const snapshot = await adminDb().collection("shops").doc(shopId).get();
  if (!snapshot.exists) return null;
  const shop = normalizeShop(mapDoc<Shop>(snapshot.id, snapshot.data() ?? {}));
  if (!options?.includeUnapproved && shop.approvalStatus !== "approved") {
    return null;
  }
  return shop;
}

export async function getShopByOwnerId(ownerId: string) {
  const snapshot = await adminDb()
    .collection("shops")
    .where("ownerId", "==", ownerId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return normalizeShop(mapDoc<Shop>(doc.id, doc.data()));
}

export async function getShopByLinkedAccountId(razorpayLinkedAccountId: string) {
  const snapshot = await adminDb()
    .collection("shops")
    .where("razorpayLinkedAccountId", "==", razorpayLinkedAccountId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return normalizeShop(mapDoc<Shop>(doc.id, doc.data()));
}

export async function createShop(params: {
  ownerId: string;
  approvalStatus?: ShopApprovalStatus;
  shopName: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  googleMapsUrl?: string;
  phone: string;
  settlementEmail?: string;
  description: string;
  services: string[];
  businessType?: string;
  razorpayLinkedAccountId: string;
  razorpayLinkedAccountStatus?: string;
  razorpayStakeholderId?: string;
  razorpayProductId?: string;
  razorpayProductStatus?: string;
  razorpayLinkedAccountStatusReason?: string;
  razorpayLinkedAccountStatusDescription?: string;
  razorpayProductRequirements?: Shop["razorpayProductRequirements"];
  razorpayOwnerPanStatus?: string;
  razorpayBankVerificationStatus?: string;
  razorpayRouteTermsAccepted?: boolean;
  paymentBlockedReason?: string;
  razorpayStatusLastSyncedAt?: string | null;
  bankAccountHolderName?: string;
  bankIfsc?: string;
  bankAccountLast4?: string;
  pendingBankAccountNumber?: string;
  pendingOwnerPan?: string;
  pendingRouteTermsAccepted?: boolean;
  onlinePaymentsEnabled?: boolean;
  paymentOnboardingNote?: string;
  subscriptionStatus?: Shop["subscriptionStatus"];
  subscriptionValidUntil?: string | null;
  razorpaySubscriptionOrderId?: string | null;
  razorpaySubscriptionPaymentId?: string | null;
  isActive?: boolean;
  pricing: Shop["pricing"];
}) {
  const existing = await getShopByOwnerId(params.ownerId);
  if (existing) {
    throw new Error("Shop owner already has a shop.");
  }

  const ref = adminDb().collection("shops").doc();
  await ref.set({
    id: ref.id,
    ownerId: params.ownerId,
    approvalStatus: params.approvalStatus || "approved",
    approvalSubmittedAt:
      params.approvalStatus === "pending_approval" ? FieldValue.serverTimestamp() : null,
    approvedAt: params.approvalStatus === "approved" ? FieldValue.serverTimestamp() : null,
    rejectedAt: null,
    shopName: params.shopName,
    address: params.address,
    city: params.city,
    state: params.state,
    postalCode: params.postalCode,
    businessType: params.businessType || "individual",
    googleMapsUrl: params.googleMapsUrl || "",
    phone: params.phone,
    settlementEmail: String(params.settlementEmail || "").trim().toLowerCase(),
    description: params.description,
    services: params.services,
    razorpayLinkedAccountId: params.razorpayLinkedAccountId,
    razorpayLinkedAccountStatus: params.razorpayLinkedAccountStatus || "created",
    razorpayStakeholderId: params.razorpayStakeholderId || "",
    razorpayProductId: params.razorpayProductId || "",
    razorpayProductStatus: params.razorpayProductStatus || "",
    razorpayLinkedAccountStatusReason: params.razorpayLinkedAccountStatusReason || "",
    razorpayLinkedAccountStatusDescription: params.razorpayLinkedAccountStatusDescription || "",
    razorpayProductRequirements: params.razorpayProductRequirements || [],
    razorpayOwnerPanStatus: params.razorpayOwnerPanStatus || "",
    razorpayBankVerificationStatus: params.razorpayBankVerificationStatus || "",
    razorpayRouteTermsAccepted: Boolean(params.razorpayRouteTermsAccepted),
    paymentBlockedReason: params.paymentBlockedReason || "",
    razorpayStatusLastSyncedAt: params.razorpayStatusLastSyncedAt || null,
    bankAccountHolderName: params.bankAccountHolderName || "",
    bankIfsc: params.bankIfsc || "",
    bankAccountLast4: params.bankAccountLast4 || "",
    pendingBankAccountNumber: params.pendingBankAccountNumber || "",
    pendingOwnerPan: params.pendingOwnerPan || "",
    pendingRouteTermsAccepted: Boolean(params.pendingRouteTermsAccepted),
    onlinePaymentsEnabled: Boolean(params.onlinePaymentsEnabled),
    paymentOnboardingNote: String(params.paymentOnboardingNote || "").trim(),
    subscriptionStatus: params.subscriptionStatus || "inactive",
    subscriptionValidUntil: params.subscriptionValidUntil || null,
    razorpaySubscriptionOrderId: params.razorpaySubscriptionOrderId || null,
    razorpaySubscriptionPaymentId: params.razorpaySubscriptionPaymentId || null,
    isActive: Boolean(params.isActive),
    pricing: params.pricing,
    createdAt: FieldValue.serverTimestamp(),
  });

  return getShopById(ref.id, { includeUnapproved: true });
}

export async function updateShop(params: {
  shopId: string;
  ownerId: string;
  approvalStatus?: ShopApprovalStatus;
  shopName: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  googleMapsUrl?: string;
  phone: string;
  settlementEmail?: string;
  description: string;
  services: string[];
  businessType?: string;
  razorpayLinkedAccountId: string;
  razorpayLinkedAccountStatus?: string;
  razorpayStakeholderId?: string;
  razorpayProductId?: string;
  razorpayProductStatus?: string;
  razorpayLinkedAccountStatusReason?: string;
  razorpayLinkedAccountStatusDescription?: string;
  razorpayProductRequirements?: Shop["razorpayProductRequirements"];
  razorpayOwnerPanStatus?: string;
  razorpayBankVerificationStatus?: string;
  razorpayRouteTermsAccepted?: boolean;
  paymentBlockedReason?: string;
  razorpayStatusLastSyncedAt?: string | null;
  bankAccountHolderName?: string;
  bankIfsc?: string;
  bankAccountLast4?: string;
  pendingBankAccountNumber?: string;
  pendingOwnerPan?: string;
  pendingRouteTermsAccepted?: boolean;
  onlinePaymentsEnabled?: boolean;
  paymentOnboardingNote?: string;
  subscriptionStatus?: Shop["subscriptionStatus"];
  subscriptionValidUntil?: string | null;
  razorpaySubscriptionOrderId?: string | null;
  razorpaySubscriptionPaymentId?: string | null;
  isActive?: boolean;
  pricing: Shop["pricing"];
}) {
  const existing = await getShopById(params.shopId, { includeUnapproved: true });
  if (!existing || existing.ownerId !== params.ownerId) {
    throw new Error("Shop not found.");
  }

  await adminDb().collection("shops").doc(params.shopId).set(
    {
      ...(params.approvalStatus ? { approvalStatus: params.approvalStatus } : {}),
      ...(params.approvalStatus === "pending_approval"
        ? {
            approvalSubmittedAt: FieldValue.serverTimestamp(),
            rejectedAt: null,
          }
        : {}),
      shopName: params.shopName,
      address: params.address,
      city: params.city,
      state: params.state,
      postalCode: params.postalCode,
      businessType: params.businessType || existing.businessType || "individual",
      googleMapsUrl: params.googleMapsUrl || "",
      phone: params.phone,
      settlementEmail: String(params.settlementEmail || "").trim().toLowerCase(),
      description: params.description,
      services: params.services,
      razorpayLinkedAccountId: params.razorpayLinkedAccountId,
      razorpayLinkedAccountStatus: params.razorpayLinkedAccountStatus || "created",
      razorpayStakeholderId: params.razorpayStakeholderId || "",
      razorpayProductId: params.razorpayProductId || "",
      razorpayProductStatus: params.razorpayProductStatus || "",
      razorpayLinkedAccountStatusReason: params.razorpayLinkedAccountStatusReason || "",
      razorpayLinkedAccountStatusDescription: params.razorpayLinkedAccountStatusDescription || "",
      razorpayProductRequirements: params.razorpayProductRequirements || [],
      razorpayOwnerPanStatus: params.razorpayOwnerPanStatus || "",
      razorpayBankVerificationStatus: params.razorpayBankVerificationStatus || "",
      razorpayRouteTermsAccepted: Boolean(params.razorpayRouteTermsAccepted),
      paymentBlockedReason: params.paymentBlockedReason || "",
      razorpayStatusLastSyncedAt: params.razorpayStatusLastSyncedAt || null,
      bankAccountHolderName: params.bankAccountHolderName || "",
      bankIfsc: params.bankIfsc || "",
      bankAccountLast4: params.bankAccountLast4 || "",
      pendingBankAccountNumber: params.pendingBankAccountNumber || "",
      pendingOwnerPan: params.pendingOwnerPan || "",
      pendingRouteTermsAccepted: Boolean(params.pendingRouteTermsAccepted),
      onlinePaymentsEnabled:
        params.onlinePaymentsEnabled ?? existing.onlinePaymentsEnabled ?? false,
      paymentOnboardingNote:
        params.paymentOnboardingNote ?? existing.paymentOnboardingNote ?? "",
      subscriptionStatus: params.subscriptionStatus || existing.subscriptionStatus || "inactive",
      subscriptionValidUntil: params.subscriptionValidUntil ?? existing.subscriptionValidUntil ?? null,
      razorpaySubscriptionOrderId:
        params.razorpaySubscriptionOrderId ?? existing.razorpaySubscriptionOrderId ?? null,
      razorpaySubscriptionPaymentId:
        params.razorpaySubscriptionPaymentId ?? existing.razorpaySubscriptionPaymentId ?? null,
      isActive: params.isActive ?? existing.isActive ?? false,
      pricing: params.pricing,
    },
    { merge: true },
  );

  return getShopById(params.shopId, { includeUnapproved: true });
}

export async function updateShopRazorpayStatus(params: {
  shopId: string;
  razorpayLinkedAccountStatus?: string;
  razorpayProductStatus?: string;
  razorpayProductResolutionUrl?: string;
  razorpayLinkedAccountStatusReason?: string;
  razorpayLinkedAccountStatusDescription?: string;
  razorpayProductRequirements?: Shop["razorpayProductRequirements"];
  razorpayOwnerPanStatus?: string;
  razorpayBankVerificationStatus?: string;
  razorpayRouteTermsAccepted?: boolean;
  paymentBlockedReason?: string;
  isActive?: boolean;
  onlinePaymentsEnabled?: boolean;
  paymentOnboardingNote?: string;
}) {
  await adminDb().collection("shops").doc(params.shopId).set(
    {
      ...(params.razorpayLinkedAccountStatus !== undefined
        ? { razorpayLinkedAccountStatus: params.razorpayLinkedAccountStatus }
        : {}),
      ...(params.razorpayProductStatus !== undefined
        ? { razorpayProductStatus: params.razorpayProductStatus }
        : {}),
      ...(params.razorpayProductResolutionUrl !== undefined
        ? { razorpayProductResolutionUrl: params.razorpayProductResolutionUrl }
        : {}),
      ...(params.razorpayLinkedAccountStatusReason !== undefined
        ? { razorpayLinkedAccountStatusReason: params.razorpayLinkedAccountStatusReason }
        : {}),
      ...(params.razorpayLinkedAccountStatusDescription !== undefined
        ? { razorpayLinkedAccountStatusDescription: params.razorpayLinkedAccountStatusDescription }
        : {}),
      ...(params.razorpayProductRequirements !== undefined
        ? { razorpayProductRequirements: params.razorpayProductRequirements }
        : {}),
      ...(params.razorpayOwnerPanStatus !== undefined
        ? { razorpayOwnerPanStatus: params.razorpayOwnerPanStatus }
        : {}),
      ...(params.razorpayBankVerificationStatus !== undefined
        ? { razorpayBankVerificationStatus: params.razorpayBankVerificationStatus }
        : {}),
      ...(params.razorpayRouteTermsAccepted !== undefined
        ? { razorpayRouteTermsAccepted: params.razorpayRouteTermsAccepted }
        : {}),
      ...(params.paymentBlockedReason !== undefined
        ? { paymentBlockedReason: params.paymentBlockedReason }
        : {}),
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
      ...(params.onlinePaymentsEnabled !== undefined
        ? { onlinePaymentsEnabled: Boolean(params.onlinePaymentsEnabled) }
        : {}),
      ...(params.paymentOnboardingNote !== undefined
        ? { paymentOnboardingNote: String(params.paymentOnboardingNote || "").trim() }
        : {}),
      razorpayStatusLastSyncedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return getShopById(params.shopId, { includeUnapproved: true });
}

export async function updateShopApproval(params: {
  shopId: string;
  approvalStatus: ShopApprovalStatus;
  razorpayLinkedAccountId?: string;
  razorpayLinkedAccountStatus?: string;
  razorpayStakeholderId?: string;
  razorpayProductId?: string;
  razorpayProductStatus?: string;
  razorpayProductResolutionUrl?: string;
  razorpayLinkedAccountStatusReason?: string;
  razorpayLinkedAccountStatusDescription?: string;
  razorpayProductRequirements?: Shop["razorpayProductRequirements"];
  razorpayOwnerPanStatus?: string;
  razorpayBankVerificationStatus?: string;
  razorpayRouteTermsAccepted?: boolean;
  paymentBlockedReason?: string;
  isActive?: boolean;
  settlementEmail?: string;
  onboardingStep?: string;
  onboardingError?: string;
  routeActivationStatus?: string;
  routeRequirementsJson?: string;
  routeRawResponseJson?: string;
  bankAccountHolderName?: string;
  bankIfsc?: string;
  bankAccountLast4?: string;
  onlinePaymentsEnabled?: boolean;
  paymentOnboardingNote?: string;
}) {
  await adminDb().collection("shops").doc(params.shopId).set(
    {
      approvalStatus: params.approvalStatus,
      ...(params.approvalStatus === "approved"
        ? {
            approvedAt: FieldValue.serverTimestamp(),
            rejectedAt: null,
          }
        : {}),
      ...(params.approvalStatus === "rejected"
        ? {
            rejectedAt: FieldValue.serverTimestamp(),
          }
        : {}),
      ...(params.approvalStatus !== "pending_approval" ? { approvalSubmittedAt: null } : {}),
      ...(params.razorpayLinkedAccountId !== undefined
        ? { razorpayLinkedAccountId: params.razorpayLinkedAccountId }
        : {}),
      ...(params.razorpayLinkedAccountStatus !== undefined
        ? { razorpayLinkedAccountStatus: params.razorpayLinkedAccountStatus }
        : {}),
      ...(params.razorpayStakeholderId !== undefined
        ? { razorpayStakeholderId: params.razorpayStakeholderId }
        : {}),
      ...(params.razorpayProductId !== undefined ? { razorpayProductId: params.razorpayProductId } : {}),
      ...(params.razorpayProductStatus !== undefined
        ? { razorpayProductStatus: params.razorpayProductStatus }
        : {}),
      ...(params.razorpayProductResolutionUrl !== undefined
        ? { razorpayProductResolutionUrl: params.razorpayProductResolutionUrl }
        : {}),
      ...(params.razorpayLinkedAccountStatusReason !== undefined
        ? { razorpayLinkedAccountStatusReason: params.razorpayLinkedAccountStatusReason }
        : {}),
      ...(params.razorpayLinkedAccountStatusDescription !== undefined
        ? { razorpayLinkedAccountStatusDescription: params.razorpayLinkedAccountStatusDescription }
        : {}),
      ...(params.razorpayProductRequirements !== undefined
        ? { razorpayProductRequirements: params.razorpayProductRequirements }
        : {}),
      ...(params.razorpayOwnerPanStatus !== undefined
        ? { razorpayOwnerPanStatus: params.razorpayOwnerPanStatus }
        : {}),
      ...(params.razorpayBankVerificationStatus !== undefined
        ? { razorpayBankVerificationStatus: params.razorpayBankVerificationStatus }
        : {}),
      ...(params.razorpayRouteTermsAccepted !== undefined
        ? { razorpayRouteTermsAccepted: params.razorpayRouteTermsAccepted }
        : {}),
      ...(params.paymentBlockedReason !== undefined
        ? { paymentBlockedReason: params.paymentBlockedReason }
        : {}),
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
      ...(params.settlementEmail !== undefined
        ? { settlementEmail: String(params.settlementEmail || "").trim().toLowerCase() }
        : {}),
      ...(params.onboardingStep !== undefined
        ? {
            onboardingStep: String(params.onboardingStep || "").trim(),
            onboarding_step: String(params.onboardingStep || "").trim(),
          }
        : {}),
      ...(params.onboardingError !== undefined
        ? {
            onboardingError: String(params.onboardingError || "").trim(),
            onboarding_error: String(params.onboardingError || "").trim(),
          }
        : {}),
      ...(params.routeActivationStatus !== undefined
        ? { route_activation_status: String(params.routeActivationStatus || "").trim() }
        : {}),
      ...(params.routeRequirementsJson !== undefined
        ? { route_requirements_json: String(params.routeRequirementsJson || "").trim() }
        : {}),
      ...(params.routeRawResponseJson !== undefined
        ? { route_raw_response_json: String(params.routeRawResponseJson || "").trim() }
        : {}),
      ...(params.bankAccountHolderName !== undefined
        ? { bankAccountHolderName: params.bankAccountHolderName }
        : {}),
      ...(params.bankIfsc !== undefined ? { bankIfsc: params.bankIfsc } : {}),
      ...(params.bankAccountLast4 !== undefined ? { bankAccountLast4: params.bankAccountLast4 } : {}),
      ...(params.onlinePaymentsEnabled !== undefined
        ? { onlinePaymentsEnabled: Boolean(params.onlinePaymentsEnabled) }
        : {}),
      ...(params.paymentOnboardingNote !== undefined
        ? { paymentOnboardingNote: String(params.paymentOnboardingNote || "").trim() }
        : {}),
      ...(params.approvalStatus === "approved"
        ? {
            razorpayStatusLastSyncedAt: FieldValue.serverTimestamp(),
          }
        : {}),
      ...(params.approvalStatus === "approved" && params.isActive
        ? {
            pendingBankAccountNumber: "",
            pendingOwnerPan: "",
            pendingRouteTermsAccepted: false,
          }
        : {}),
    },
    { merge: true },
  );

  return getShopById(params.shopId, { includeUnapproved: true });
}

export async function updateShopRouteDetails(params: {
  shopId: string;
  razorpayLinkedAccountId?: string;
  razorpayLinkedAccountStatus?: string;
  razorpayStakeholderId?: string;
  razorpayProductId?: string;
  razorpayProductStatus?: string;
  razorpayProductResolutionUrl?: string;
  razorpayLinkedAccountStatusReason?: string;
  razorpayLinkedAccountStatusDescription?: string;
  razorpayProductRequirements?: Shop["razorpayProductRequirements"];
  razorpayOwnerPanStatus?: string;
  razorpayBankVerificationStatus?: string;
  razorpayRouteTermsAccepted?: boolean;
  paymentBlockedReason?: string;
  isActive?: boolean;
  settlementEmail?: string;
  onboardingStep?: string;
  onboardingError?: string;
  routeActivationStatus?: string;
  routeRequirementsJson?: string;
  routeRawResponseJson?: string;
  bankAccountHolderName?: string;
  bankIfsc?: string;
  bankAccountLast4?: string;
  onlinePaymentsEnabled?: boolean;
  paymentOnboardingNote?: string;
}) {
  await adminDb().collection("shops").doc(params.shopId).set(
    {
      ...(params.razorpayLinkedAccountId !== undefined
        ? { razorpayLinkedAccountId: String(params.razorpayLinkedAccountId || "").trim() }
        : {}),
      ...(params.razorpayLinkedAccountStatus !== undefined
        ? { razorpayLinkedAccountStatus: String(params.razorpayLinkedAccountStatus || "").trim() }
        : {}),
      ...(params.razorpayStakeholderId !== undefined
        ? { razorpayStakeholderId: String(params.razorpayStakeholderId || "").trim() }
        : {}),
      ...(params.razorpayProductId !== undefined
        ? { razorpayProductId: String(params.razorpayProductId || "").trim() }
        : {}),
      ...(params.razorpayProductStatus !== undefined
        ? { razorpayProductStatus: String(params.razorpayProductStatus || "").trim() }
        : {}),
      ...(params.razorpayProductResolutionUrl !== undefined
        ? { razorpayProductResolutionUrl: String(params.razorpayProductResolutionUrl || "").trim() }
        : {}),
      ...(params.razorpayLinkedAccountStatusReason !== undefined
        ? {
            razorpayLinkedAccountStatusReason: String(
              params.razorpayLinkedAccountStatusReason || "",
            ).trim(),
          }
        : {}),
      ...(params.razorpayLinkedAccountStatusDescription !== undefined
        ? {
            razorpayLinkedAccountStatusDescription: String(
              params.razorpayLinkedAccountStatusDescription || "",
            ).trim(),
          }
        : {}),
      ...(params.razorpayProductRequirements !== undefined
        ? {
            razorpayProductRequirements: params.razorpayProductRequirements.map((requirement) => ({
              fieldReference: String(requirement?.fieldReference || "").trim(),
              resolutionUrl: String(requirement?.resolutionUrl || "").trim(),
              reasonCode: String(requirement?.reasonCode || "").trim(),
              status: String(requirement?.status || "").trim(),
            })),
          }
        : {}),
      ...(params.razorpayOwnerPanStatus !== undefined
        ? { razorpayOwnerPanStatus: String(params.razorpayOwnerPanStatus || "").trim() }
        : {}),
      ...(params.razorpayBankVerificationStatus !== undefined
        ? {
            razorpayBankVerificationStatus: String(
              params.razorpayBankVerificationStatus || "",
            ).trim(),
          }
        : {}),
      ...(params.razorpayRouteTermsAccepted !== undefined
        ? { razorpayRouteTermsAccepted: Boolean(params.razorpayRouteTermsAccepted) }
        : {}),
      ...(params.paymentBlockedReason !== undefined
        ? { paymentBlockedReason: String(params.paymentBlockedReason || "").trim() }
        : {}),
      ...(params.isActive !== undefined ? { isActive: Boolean(params.isActive) } : {}),
      ...(params.settlementEmail !== undefined
        ? { settlementEmail: String(params.settlementEmail || "").trim().toLowerCase() }
        : {}),
      ...(params.onboardingStep !== undefined
        ? {
            onboardingStep: String(params.onboardingStep || "").trim(),
            onboarding_step: String(params.onboardingStep || "").trim(),
          }
        : {}),
      ...(params.onboardingError !== undefined
        ? {
            onboardingError: String(params.onboardingError || "").trim(),
            onboarding_error: String(params.onboardingError || "").trim(),
          }
        : {}),
      ...(params.routeActivationStatus !== undefined
        ? { route_activation_status: String(params.routeActivationStatus || "").trim() }
        : {}),
      ...(params.routeRequirementsJson !== undefined
        ? { route_requirements_json: String(params.routeRequirementsJson || "").trim() }
        : {}),
      ...(params.routeRawResponseJson !== undefined
        ? { route_raw_response_json: String(params.routeRawResponseJson || "").trim() }
        : {}),
      ...(params.bankAccountHolderName !== undefined
        ? { bankAccountHolderName: String(params.bankAccountHolderName || "").trim() }
        : {}),
      ...(params.bankIfsc !== undefined ? { bankIfsc: String(params.bankIfsc || "").trim() } : {}),
      ...(params.bankAccountLast4 !== undefined
        ? { bankAccountLast4: String(params.bankAccountLast4 || "").trim() }
        : {}),
      ...(params.onlinePaymentsEnabled !== undefined
        ? { onlinePaymentsEnabled: Boolean(params.onlinePaymentsEnabled) }
        : {}),
      ...(params.paymentOnboardingNote !== undefined
        ? { paymentOnboardingNote: String(params.paymentOnboardingNote || "").trim() }
        : {}),
      ...(params.razorpayProductRequirements !== undefined ||
      params.razorpayLinkedAccountStatus !== undefined ||
      params.razorpayProductStatus !== undefined
        ? { razorpayStatusLastSyncedAt: FieldValue.serverTimestamp() }
        : {}),
    },
    { merge: true },
  );

  return getShopById(params.shopId, { includeUnapproved: true });
}

export async function resetShopRouteOnboarding(params: {
  shopId: string;
  onboardingError?: string;
  onboardingStep?: string;
  paymentBlockedReason?: string;
}) {
  await adminDb().collection("shops").doc(params.shopId).set(
    {
      razorpayLinkedAccountId: "",
      razorpayLinkedAccountStatus: "",
      razorpayStakeholderId: "",
      razorpayProductId: "",
      razorpayProductStatus: "",
      razorpayProductResolutionUrl: "",
      razorpayLinkedAccountStatusReason: "",
      razorpayLinkedAccountStatusDescription: "",
      razorpayProductRequirements: [],
      razorpayOwnerPanStatus: "",
      razorpayBankVerificationStatus: "",
      razorpayRouteTermsAccepted: false,
      paymentBlockedReason: String(params.paymentBlockedReason || "").trim(),
      onboardingError: String(params.onboardingError || "").trim(),
      onboarding_error: String(params.onboardingError || "").trim(),
      onboardingStep: String(params.onboardingStep || "not_started").trim(),
      onboarding_step: String(params.onboardingStep || "not_started").trim(),
      isActive: false,
      route_activation_status: "",
      route_requirements_json: "",
      route_resolution_url: "",
      route_raw_response_json: "",
      razorpay_account_id: "",
      razorpay_stakeholder_id: "",
      razorpay_product_id: "",
      is_accepting_orders: false,
      onlinePaymentsEnabled: false,
      paymentOnboardingNote: "",
      razorpayStatusLastSyncedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return getShopById(params.shopId, { includeUnapproved: true });
}

export async function createOrderWithFiles(params: {
  customerId: string;
  shopId: string;
  customerName: string;
  customerPhone: string;
  notes: string;
  printType: Order["printType"];
  sideType: Order["sideType"];
  pageCount: number;
  copies: number;
  pricing: Pick<
    Order,
    "printCostPaise" | "platformFeePaise" | "totalAmountPaise" | "shopEarningPaise" | "platformEarningPaise"
  >;
  files: Omit<OrderFile, "id" | "orderId" | "createdAt">[];
}) {
  const db = adminDb();
  const orderRef = db.collection("orders").doc();
  const batch = db.batch();
  const createdAt = Timestamp.now();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(createdAt.toDate().getTime() + istOffsetMs);
  const day = String(istDate.getUTCDate()).padStart(2, "0");
  const month = String(istDate.getUTCMonth() + 1).padStart(2, "0");
  const year = String(istDate.getUTCFullYear());
  const datePrefix = `${day}${month}${year}_`;
  const counterRef = db
    .collection("shops")
    .doc(params.shopId)
    .collection("order_counters")
    .doc(datePrefix.slice(0, -1));
  const nextSequence = await db.runTransaction(async (transaction) => {
    const counterSnapshot = await transaction.get(counterRef);
    const currentValue = Number(counterSnapshot.data()?.count || 0);
    const nextValue = currentValue + 1;

    transaction.set(
      counterRef,
      {
        count: nextValue,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return nextValue;
  });
  const nthOrder = String(nextSequence).padStart(3, "0");
  const trackingCode = `${day}${month}${year}_${nthOrder}`;

  batch.set(orderRef, {
    id: orderRef.id,
    trackingCode,
    customerId: params.customerId,
    shopId: params.shopId,
    customerName: params.customerName,
    customerPhone: params.customerPhone,
    notes: params.notes,
    printType: params.printType,
    sideType: params.sideType,
    pageCount: params.pageCount,
    copies: params.copies,
    printCostPaise: params.pricing.printCostPaise,
    platformFeePaise: params.pricing.platformFeePaise,
    totalAmountPaise: params.pricing.totalAmountPaise,
    shopEarningPaise: params.pricing.shopEarningPaise,
    platformEarningPaise: params.pricing.platformEarningPaise,
    paymentStatus: "unpaid",
    paymentIntentStatus: "idle",
    paymentAttemptAmountPaise: null,
    razorpayOrderId: null,
    razorpayPaymentId: null,
    platformCommissionPaise: null,
    platformTransactionFeePaise: null,
    estimatedFeePaise: null,
    estimatedTaxPaise: null,
    gatewayFeeSource: null,
    transferableAmountPaise: null,
    transferId: null,
    transferStatus: "not_created",
    linkedAccountId: null,
    settlementStatus: null,
    settlementPaidAt: null,
    refundId: null,
    refundedAmountPaise: null,
    paidAt: null,
    status: "pending",
    createdAt,
  });

  params.files.forEach((file) => {
    const fileRef = db.collection("order_files").doc();
    batch.set(fileRef, {
      id: fileRef.id,
      orderId: orderRef.id,
      originalFileName: file.originalFileName,
      s3Key: file.s3Key,
      s3Url: file.s3Url,
      mimeType: file.mimeType,
      size: file.size,
      downloadedAt: null,
      downloadedByOwnerId: null,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();

  return getOrderById(orderRef.id);
}

export async function getOrderById(orderId: string) {
  const snapshot = await adminDb().collection("orders").doc(orderId).get();
  if (!snapshot.exists) return null;

  const order = normalizeOrder(mapDoc<Order>(snapshot.id, snapshot.data() ?? {}));
  const files = await getFilesByOrderIds([orderId]);

  return {
    ...order,
    files: files[orderId] ?? [],
  } satisfies OrderWithFiles;
}

function chunk<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

export async function getFilesByOrderIds(orderIds: string[]) {
  const grouped: Record<string, OrderFile[]> = {};
  if (orderIds.length === 0) return grouped;

  const chunks = chunk(orderIds, 10);
  await Promise.all(
    chunks.map(async (ids) => {
      const snapshot = await adminDb()
        .collection("order_files")
        .where("orderId", "in", ids)
        .get();

      snapshot.docs.forEach((doc) => {
        const file = normalizeOrderFile(mapDoc<OrderFile>(doc.id, doc.data()));
        grouped[file.orderId] = [...(grouped[file.orderId] ?? []), file];
      });
    }),
  );

  return grouped;
}

export async function getOrdersForShop(shopId: string) {
  const snapshot = await adminDb()
    .collection("orders")
    .where("shopId", "==", shopId)
    .get();

  const orders = snapshot.docs
    .map((doc) => normalizeOrder(mapDoc<Order>(doc.id, doc.data())))
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  const filesByOrderId = await getFilesByOrderIds(orders.map((order) => order.id));

  return orders.map((order) => ({
    ...order,
    files: filesByOrderId[order.id] ?? [],
  })) as OrderWithFiles[];
}

export async function getOrdersForCustomer(customerId: string) {
  const snapshot = await adminDb()
    .collection("orders")
    .where("customerId", "==", customerId)
    .get();

  const orders = snapshot.docs
    .map((doc) => normalizeOrder(mapDoc<Order>(doc.id, doc.data())))
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

  const filesByOrderId = await getFilesByOrderIds(orders.map((order) => order.id));

  return orders.map((order) => ({
    ...order,
    files: filesByOrderId[order.id] ?? [],
  })) as OrderWithFiles[];
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
) {
  await adminDb().collection("orders").doc(orderId).set({ status }, { merge: true });

  return getOrderById(orderId);
}

export async function beginOrderPaymentIntent(params: {
  orderId: string;
  amountPaise: number;
}) {
  const ref = adminDb().collection("orders").doc(params.orderId);

  return adminDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);

    if (!snapshot.exists) {
      throw new Error("Order not found.");
    }

    const data = snapshot.data() ?? {};
    const paymentStatus = String(data.paymentStatus || "unpaid");
    const paymentIntentStatus = String(data.paymentIntentStatus || "idle");
    const existingAmount =
      data.paymentAttemptAmountPaise === null || data.paymentAttemptAmountPaise === undefined
        ? null
        : Number(data.paymentAttemptAmountPaise);
    const existingOrderId = String(data.razorpayOrderId || "");

    if (paymentStatus === "paid") {
      return {
        action: "paid" as const,
        razorpayOrderId: existingOrderId || null,
        amountPaise: existingAmount,
      };
    }

    if (
      existingOrderId &&
      paymentIntentStatus !== "creating" &&
      (existingAmount === null || existingAmount === params.amountPaise)
    ) {
      return {
        action: "reuse" as const,
        razorpayOrderId: existingOrderId,
        amountPaise: existingAmount ?? params.amountPaise,
      };
    }

    if (paymentIntentStatus === "creating") {
      return {
        action: "creating" as const,
        razorpayOrderId: existingOrderId || null,
        amountPaise: existingAmount,
      };
    }

    transaction.set(
      ref,
      {
        paymentStatus: "unpaid",
        paymentIntentStatus: "creating",
        paymentAttemptAmountPaise: params.amountPaise,
        razorpayOrderId: null,
        razorpayPaymentId: null,
        platformCommissionPaise: null,
        platformTransactionFeePaise: null,
        estimatedFeePaise: null,
        estimatedTaxPaise: null,
        gatewayFeeSource: null,
        transferableAmountPaise: null,
        transferId: null,
        transferStatus: "not_created",
        linkedAccountId: null,
        settlementStatus: null,
        settlementPaidAt: null,
        refundId: null,
        refundedAmountPaise: null,
        paidAt: null,
      },
      { merge: true },
    );

    return {
      action: "create" as const,
      razorpayOrderId: null,
      amountPaise: params.amountPaise,
    };
  });
}

export async function finalizeOrderPaymentIntent(params: {
  orderId: string;
  razorpayOrderId: string;
  amountPaise: number;
  linkedAccountId: string;
  transferableAmountPaise: number;
}) {
  await adminDb().collection("orders").doc(params.orderId).set(
    {
      razorpayOrderId: params.razorpayOrderId,
      paymentIntentStatus: "ready",
      paymentAttemptAmountPaise: params.amountPaise,
      paymentStatus: "unpaid",
      linkedAccountId: params.linkedAccountId,
      transferableAmountPaise: params.transferableAmountPaise,
      transferStatus: "pending",
      settlementStatus: null,
    },
    { merge: true },
  );

  return getOrderById(params.orderId);
}

export async function failOrderPaymentIntent(orderId: string) {
  await adminDb().collection("orders").doc(orderId).set(
    {
      paymentIntentStatus: "idle",
    },
    { merge: true },
  );

  return getOrderById(orderId);
}

export async function markOrderPaid(params: {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
}) {
  await adminDb().collection("orders").doc(params.orderId).set(
    {
      paymentStatus: "paid",
      paymentIntentStatus: "ready",
      razorpayOrderId: params.razorpayOrderId,
      razorpayPaymentId: params.razorpayPaymentId,
      status: "confirmed",
      settlementStatus: null,
      settlementPaidAt: null,
      paidAt: FieldValue.serverTimestamp(),
      refundId: null,
      refundedAmountPaise: null,
    },
    { merge: true },
  );

  return getOrderById(params.orderId);
}

export async function markOrderPaymentVerifiedClientReturn(params: {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
}) {
  await adminDb().collection("orders").doc(params.orderId).set(
    getClientReturnVerificationPatch({
      razorpayOrderId: params.razorpayOrderId,
      razorpayPaymentId: params.razorpayPaymentId,
    }),
    { merge: true },
  );

  return getOrderById(params.orderId);
}

export async function markOrderPaymentFailed(params: {
  orderId: string;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
}) {
  await adminDb().collection("orders").doc(params.orderId).set(
    {
      paymentStatus: "payment_failed",
      paymentIntentStatus: "ready",
      ...(params.razorpayOrderId !== undefined ? { razorpayOrderId: params.razorpayOrderId } : {}),
      ...(params.razorpayPaymentId !== undefined
        ? { razorpayPaymentId: params.razorpayPaymentId }
        : {}),
      settlementStatus: null,
      settlementPaidAt: null,
      paidAt: null,
    },
    { merge: true },
  );

  return getOrderById(params.orderId);
}

export async function markOrderSettlementPaid(orderId: string) {
  await adminDb().collection("orders").doc(orderId).set(
    {
      settlementStatus: "paid",
      settlementPaidAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return getOrderById(orderId);
}

export async function updateOrderTransferSnapshot(params: {
  orderId: string;
  linkedAccountId: string;
  platformTransactionFeePaise: number;
  estimatedFeePaise: number;
  estimatedTaxPaise: number;
  gatewayFeeSource: Order["gatewayFeeSource"];
  transferableAmountPaise: number;
}) {
  await adminDb().collection("orders").doc(params.orderId).set(
    {
      linkedAccountId: params.linkedAccountId,
      platformTransactionFeePaise: params.platformTransactionFeePaise,
      estimatedFeePaise: params.estimatedFeePaise,
      estimatedTaxPaise: params.estimatedTaxPaise,
      gatewayFeeSource: params.gatewayFeeSource ?? null,
      transferableAmountPaise: params.transferableAmountPaise,
    },
    { merge: true },
  );

  return getOrderById(params.orderId);
}

export async function updateOrderTransferState(params: {
  orderId: string;
  transferId?: string | null;
  transferStatus: Order["transferStatus"];
  transferFailureReason?: string | null;
}) {
  await adminDb().collection("orders").doc(params.orderId).set(
    {
      transferId: params.transferId ?? null,
      transferStatus: params.transferStatus,
      transferFailureReason: params.transferFailureReason ?? null,
      transferUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return getOrderById(params.orderId);
}

export async function updateOrderRefundState(params: {
  orderId: string;
  paymentStatus: Order["paymentStatus"];
  refundId?: string | null;
  refundedAmountPaise?: number | null;
}) {
  await adminDb().collection("orders").doc(params.orderId).set(
    {
      paymentStatus: params.paymentStatus,
      refundId: params.refundId ?? null,
      refundedAmountPaise: params.refundedAmountPaise ?? null,
    },
    { merge: true },
  );

  return getOrderById(params.orderId);
}

export async function claimOrderTransferCreation(orderId: string) {
  const ref = adminDb().collection("orders").doc(orderId);

  return adminDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);

    if (!snapshot.exists) {
      throw new Error("Order not found.");
    }

    const data = snapshot.data() ?? {};
    const transferStatus = String(data.transferStatus || "not_created");

    if (
      data.transferId ||
      transferStatus === "processing" ||
      transferStatus === "success" ||
      transferStatus === "reversed" ||
      transferStatus === "partially_reversed"
    ) {
      return false;
    }

    transaction.set(
      ref,
      {
        transferStatus: "processing",
      },
      { merge: true },
    );

    return true;
  });
}

export async function getOrdersNeedingTransferAttention() {
  const snapshot = await adminDb()
    .collection("orders")
    .where("paymentStatus", "in", ["paid", "refund_pending", "refund_failed", "refunded"])
    .get();

  const orders = snapshot.docs
    .map((doc) => normalizeOrder(mapDoc<Order>(doc.id, doc.data() ?? {})))
    .filter((order) =>
      isTransferAttentionOrder({
        paymentStatus: order.paymentStatus,
        transferStatus: order.transferStatus,
      }),
    )
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

  const filesByOrderId = await getFilesByOrderIds(orders.map((order) => order.id));

  return orders.map((order) => ({
    ...order,
    files: filesByOrderId[order.id] ?? [],
  })) as OrderWithFiles[];
}

export async function getOrdersNeedingSettlementAttention() {
  const snapshot = await adminDb().collection("orders").where("paymentStatus", "==", "paid").get();

  const orders = snapshot.docs
    .map((doc) => normalizeOrder(mapDoc<Order>(doc.id, doc.data() ?? {})))
    .filter((order) => order.settlementStatus !== "paid")
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

  const filesByOrderId = await getFilesByOrderIds(orders.map((order) => order.id));

  return orders.map((order) => ({
    ...order,
    files: filesByOrderId[order.id] ?? [],
  })) as OrderWithFiles[];
}

export async function getOrderByPaymentId(paymentId: string) {
  const snapshot = await adminDb()
    .collection("orders")
    .where("razorpayPaymentId", "==", paymentId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  return getOrderById(snapshot.docs[0].id);
}

export async function getOrderByRazorpayOrderId(razorpayOrderId: string) {
  const snapshot = await adminDb()
    .collection("orders")
    .where("razorpayOrderId", "==", razorpayOrderId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  return getOrderById(snapshot.docs[0].id);
}

export async function getOrderByTransferId(transferId: string) {
  const snapshot = await adminDb()
    .collection("orders")
    .where("transferId", "==", transferId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  return getOrderById(snapshot.docs[0].id);
}

export async function hasProcessedWebhookEvent(eventId: string) {
  const snapshot = await adminDb().collection("razorpay_webhook_events").doc(eventId).get();
  return snapshot.exists;
}

export async function markWebhookEventProcessed(params: {
  eventId: string;
  eventName: string;
  payloadJson: string;
}) {
  await adminDb().collection("razorpay_webhook_events").doc(params.eventId).set({
    eventId: params.eventId,
    razorpayEventId: params.eventId,
    eventName: params.eventName,
    eventType: params.eventName,
    payloadJson: params.payloadJson,
    createdAt: FieldValue.serverTimestamp(),
    processedAt: FieldValue.serverTimestamp(),
  });
}

export async function createShopSubscriptionPayment(shopId: string) {
  const ref = adminDb().collection("shop_subscription_payments").doc();

  await ref.set({
    id: ref.id,
    shopId,
    amountPaise: SHOP_SUBSCRIPTION_AMOUNT_PAISE,
    razorpayOrderId: null,
    razorpayPaymentId: null,
    status: "unpaid",
    paidAt: null,
    createdAt: FieldValue.serverTimestamp(),
  });

  return getShopSubscriptionPaymentById(ref.id);
}

export async function getShopSubscriptionPaymentById(paymentId: string) {
  const snapshot = await adminDb().collection("shop_subscription_payments").doc(paymentId).get();
  if (!snapshot.exists) return null;
  return mapDoc<ShopSubscriptionPayment>(snapshot.id, snapshot.data() ?? {});
}

export async function finalizeShopSubscriptionPaymentIntent(params: {
  paymentRecordId: string;
  shopId: string;
  razorpayOrderId: string;
}) {
  await adminDb().collection("shop_subscription_payments").doc(params.paymentRecordId).set(
    {
      razorpayOrderId: params.razorpayOrderId,
      status: "unpaid",
    },
    { merge: true },
  );

  await adminDb().collection("shops").doc(params.shopId).set(
    {
      razorpaySubscriptionOrderId: params.razorpayOrderId,
    },
    { merge: true },
  );

  return getShopSubscriptionPaymentById(params.paymentRecordId);
}

export async function getShopSubscriptionPaymentByOrderId(razorpayOrderId: string) {
  const snapshot = await adminDb()
    .collection("shop_subscription_payments")
    .where("razorpayOrderId", "==", razorpayOrderId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  return getShopSubscriptionPaymentById(snapshot.docs[0].id);
}

export async function getShopSubscriptionPaymentByPaymentId(razorpayPaymentId: string) {
  const snapshot = await adminDb()
    .collection("shop_subscription_payments")
    .where("razorpayPaymentId", "==", razorpayPaymentId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  return getShopSubscriptionPaymentById(snapshot.docs[0].id);
}

export async function markShopSubscriptionPaymentPaid(params: {
  paymentRecordId: string;
  shopId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
}) {
  const shop = await getShopById(params.shopId, { includeUnapproved: true });
  const nextValidUntil = getNextSubscriptionExpiry(shop?.subscriptionValidUntil);

  await adminDb().collection("shop_subscription_payments").doc(params.paymentRecordId).set(
    {
      razorpayOrderId: params.razorpayOrderId,
      razorpayPaymentId: params.razorpayPaymentId,
      status: "paid",
      paidAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await adminDb().collection("shops").doc(params.shopId).set(
    {
      subscriptionStatus: "active",
      subscriptionValidUntil: Timestamp.fromDate(new Date(nextValidUntil)),
      razorpaySubscriptionOrderId: params.razorpayOrderId,
      razorpaySubscriptionPaymentId: params.razorpayPaymentId,
      isActive: true,
    },
    { merge: true },
  );

  return getShopSubscriptionPaymentById(params.paymentRecordId);
}

export async function markShopSubscriptionPaymentFailed(params: {
  paymentRecordId: string;
  shopId: string;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
}) {
  await adminDb().collection("shop_subscription_payments").doc(params.paymentRecordId).set(
    {
      ...(params.razorpayOrderId !== undefined ? { razorpayOrderId: params.razorpayOrderId } : {}),
      ...(params.razorpayPaymentId !== undefined
        ? { razorpayPaymentId: params.razorpayPaymentId }
        : {}),
      status: "payment_failed",
      paidAt: null,
    },
    { merge: true },
  );

  await adminDb().collection("shops").doc(params.shopId).set(
    {
      subscriptionStatus: "expired",
      isActive: false,
      ...(params.razorpayOrderId !== undefined ? { razorpaySubscriptionOrderId: params.razorpayOrderId } : {}),
      ...(params.razorpayPaymentId !== undefined
        ? { razorpaySubscriptionPaymentId: params.razorpayPaymentId }
        : {}),
    },
    { merge: true },
  );

  return getShopSubscriptionPaymentById(params.paymentRecordId);
}

export async function getOrderFileById(fileId: string) {
  const snapshot = await adminDb().collection("order_files").doc(fileId).get();
  if (!snapshot.exists) return null;
  return normalizeOrderFile(mapDoc<OrderFile>(snapshot.id, snapshot.data() ?? {}));
}

export async function markOrderFileDownloaded(params: {
  fileId: string;
  ownerId: string;
}) {
  await adminDb().collection("order_files").doc(params.fileId).set(
    {
      downloadedAt: FieldValue.serverTimestamp(),
      downloadedByOwnerId: params.ownerId,
    },
    { merge: true },
  );

  return getOrderFileById(params.fileId);
}

async function deleteDocumentsByRefs(
  refs: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>[],
) {
  for (const refsChunk of chunk(refs, 400)) {
    const batch = adminDb().batch();
    refsChunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

export async function deleteShopWithRelatedData(shopId: string) {
  const shopRef = adminDb().collection("shops").doc(shopId);
  const shopSnapshot = await shopRef.get();

  if (!shopSnapshot.exists) {
    throw new Error("Shop not found.");
  }

  const orderSnapshot = await adminDb()
    .collection("orders")
    .where("shopId", "==", shopId)
    .get();

  const orderIds = orderSnapshot.docs.map((doc) => doc.id);
  const orderFilesByOrderId = await getFilesByOrderIds(orderIds);
  const fileDocs = Object.values(orderFilesByOrderId).flat();
  const fileRefs = fileDocs.map((file) => adminDb().collection("order_files").doc(file.id));

  await deleteDocumentsByRefs(fileRefs);
  await deleteDocumentsByRefs(orderSnapshot.docs.map((doc) => doc.ref));
  await shopRef.delete();

  return {
    deletedOrderCount: orderSnapshot.size,
    deletedFileCount: fileDocs.length,
    s3Keys: fileDocs.map((file) => file.s3Key).filter(Boolean),
  };
}

export async function deleteAllOrderFileRecords() {
  const snapshot = await adminDb()
    .collection("order_files")
    .where("downloadedAt", "!=", null)
    .get();
  const files = snapshot.docs.map((doc) =>
    normalizeOrderFile(mapDoc<OrderFile>(doc.id, doc.data() ?? {})),
  );

  await deleteDocumentsByRefs(snapshot.docs.map((doc) => doc.ref));

  return {
    deletedFileRecordCount: files.length,
    s3Keys: files.map((file) => file.s3Key).filter(Boolean),
  };
}
