import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { canShopReceiveOnlinePayments } from "@/lib/payments/shop-readiness";
import type {
  Order,
  OrderFile,
  OrderStatus,
  OrderWithFiles,
  Shop,
  ShopApprovalStatus,
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

function mapDoc<T>(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    ...data,
    createdAt: timestampToIso(data.createdAt),
    approvalSubmittedAt: timestampToIso(data.approvalSubmittedAt),
    approvedAt: timestampToIso(data.approvedAt),
    rejectedAt: timestampToIso(data.rejectedAt),
    paidAt: timestampToIso(data.paidAt),
    downloadedAt: timestampToIso(data.downloadedAt),
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
    googleMapsUrl: normalizeGoogleMapsUrl(
      (shop as Shop & { location?: string }).googleMapsUrl ||
        (shop as Shop & { location?: string }).location,
    ),
    services: Array.isArray(shop.services) ? shop.services : [],
    razorpayLinkedAccountId: String(shop.razorpayLinkedAccountId || "").trim(),
    razorpayLinkedAccountStatus: String(shop.razorpayLinkedAccountStatus || "").trim(),
    razorpayStakeholderId: String(shop.razorpayStakeholderId || "").trim(),
    razorpayProductId: String(shop.razorpayProductId || "").trim(),
    razorpayProductStatus: String(shop.razorpayProductStatus || "").trim(),
    bankAccountHolderName: String(shop.bankAccountHolderName || "").trim(),
    bankIfsc: String(shop.bankIfsc || "").trim(),
    bankAccountLast4: String(shop.bankAccountLast4 || "").trim(),
    pendingBankAccountNumber: String(shop.pendingBankAccountNumber || "").trim(),
    pendingOwnerPan: String(shop.pendingOwnerPan || "").trim(),
    pendingRouteTermsAccepted: Boolean(shop.pendingRouteTermsAccepted),
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
    finalAmount:
      order.finalAmount === null || order.finalAmount === undefined
        ? null
        : Number(order.finalAmount),
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
    linkedAccountId: order.linkedAccountId || null,
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
    : shops.filter(
        (shop) => shop.approvalStatus === "approved" && canShopReceiveOnlinePayments(shop),
      );
}

export async function getShopById(shopId: string, options?: { includeUnapproved?: boolean }) {
  const snapshot = await adminDb().collection("shops").doc(shopId).get();
  if (!snapshot.exists) return null;
  const shop = normalizeShop(mapDoc<Shop>(snapshot.id, snapshot.data() ?? {}));
  if (
    !options?.includeUnapproved &&
    (shop.approvalStatus !== "approved" || !canShopReceiveOnlinePayments(shop))
  ) {
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
  description: string;
  services: string[];
  razorpayLinkedAccountId: string;
  razorpayLinkedAccountStatus?: string;
  razorpayStakeholderId?: string;
  razorpayProductId?: string;
  razorpayProductStatus?: string;
  bankAccountHolderName?: string;
  bankIfsc?: string;
  bankAccountLast4?: string;
  pendingBankAccountNumber?: string;
  pendingOwnerPan?: string;
  pendingRouteTermsAccepted?: boolean;
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
    googleMapsUrl: params.googleMapsUrl || "",
    phone: params.phone,
    description: params.description,
    services: params.services,
    razorpayLinkedAccountId: params.razorpayLinkedAccountId,
    razorpayLinkedAccountStatus: params.razorpayLinkedAccountStatus || "created",
    razorpayStakeholderId: params.razorpayStakeholderId || "",
    razorpayProductId: params.razorpayProductId || "",
    razorpayProductStatus: params.razorpayProductStatus || "",
    bankAccountHolderName: params.bankAccountHolderName || "",
    bankIfsc: params.bankIfsc || "",
    bankAccountLast4: params.bankAccountLast4 || "",
    pendingBankAccountNumber: params.pendingBankAccountNumber || "",
    pendingOwnerPan: params.pendingOwnerPan || "",
    pendingRouteTermsAccepted: Boolean(params.pendingRouteTermsAccepted),
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
  description: string;
  services: string[];
  razorpayLinkedAccountId: string;
  razorpayLinkedAccountStatus?: string;
  razorpayStakeholderId?: string;
  razorpayProductId?: string;
  razorpayProductStatus?: string;
  bankAccountHolderName?: string;
  bankIfsc?: string;
  bankAccountLast4?: string;
  pendingBankAccountNumber?: string;
  pendingOwnerPan?: string;
  pendingRouteTermsAccepted?: boolean;
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
      googleMapsUrl: params.googleMapsUrl || "",
      phone: params.phone,
      description: params.description,
      services: params.services,
      razorpayLinkedAccountId: params.razorpayLinkedAccountId,
      razorpayLinkedAccountStatus: params.razorpayLinkedAccountStatus || "created",
      razorpayStakeholderId: params.razorpayStakeholderId || "",
      razorpayProductId: params.razorpayProductId || "",
      razorpayProductStatus: params.razorpayProductStatus || "",
      bankAccountHolderName: params.bankAccountHolderName || "",
      bankIfsc: params.bankIfsc || "",
      bankAccountLast4: params.bankAccountLast4 || "",
      pendingBankAccountNumber: params.pendingBankAccountNumber || "",
      pendingOwnerPan: params.pendingOwnerPan || "",
      pendingRouteTermsAccepted: Boolean(params.pendingRouteTermsAccepted),
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
}) {
  await adminDb().collection("shops").doc(params.shopId).set(
    {
      ...(params.razorpayLinkedAccountStatus !== undefined
        ? { razorpayLinkedAccountStatus: params.razorpayLinkedAccountStatus }
        : {}),
      ...(params.razorpayProductStatus !== undefined
        ? { razorpayProductStatus: params.razorpayProductStatus }
        : {}),
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
  bankAccountHolderName?: string;
  bankIfsc?: string;
  bankAccountLast4?: string;
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
      ...(params.bankAccountHolderName !== undefined
        ? { bankAccountHolderName: params.bankAccountHolderName }
        : {}),
      ...(params.bankIfsc !== undefined ? { bankIfsc: params.bankIfsc } : {}),
      ...(params.bankAccountLast4 !== undefined ? { bankAccountLast4: params.bankAccountLast4 } : {}),
      ...(params.approvalStatus === "approved"
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
  bankAccountHolderName?: string;
  bankIfsc?: string;
  bankAccountLast4?: string;
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
      ...(params.bankAccountHolderName !== undefined
        ? { bankAccountHolderName: String(params.bankAccountHolderName || "").trim() }
        : {}),
      ...(params.bankIfsc !== undefined ? { bankIfsc: String(params.bankIfsc || "").trim() } : {}),
      ...(params.bankAccountLast4 !== undefined
        ? { bankAccountLast4: String(params.bankAccountLast4 || "").trim() }
        : {}),
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
  copies: number;
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
    copies: params.copies,
    finalAmount: null,
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
  finalAmount?: number | null,
) {
  const ref = adminDb().collection("orders").doc(orderId);

  await adminDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);

    if (!snapshot.exists) {
      throw new Error("Order not found.");
    }

    const data = snapshot.data() ?? {};
    const paymentStatus = String(data.paymentStatus || "unpaid");
    const existingFinalAmount =
      data.finalAmount === null || data.finalAmount === undefined ? null : Number(data.finalAmount);
    const nextFinalAmount =
      finalAmount === undefined || finalAmount === null ? null : Number(finalAmount);
    const hasExistingPaymentIntent =
      paymentStatus === "unpaid" &&
      Boolean(data.razorpayOrderId) &&
      String(data.paymentIntentStatus || "idle") !== "idle";
    const amountChanged =
      nextFinalAmount !== null &&
      (existingFinalAmount === null || Math.round(existingFinalAmount * 100) !== Math.round(nextFinalAmount * 100));

    if (hasExistingPaymentIntent && amountChanged) {
      throw new Error(
        "Payment has already been initiated for this order. Create a new order flow only after resolving the existing payment attempt.",
      );
    }

    transaction.set(
      ref,
      {
        status,
        ...(finalAmount !== undefined ? { finalAmount } : {}),
      },
      { merge: true },
    );
  });

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
}) {
  await adminDb().collection("orders").doc(params.orderId).set(
    {
      razorpayOrderId: params.razorpayOrderId,
      paymentIntentStatus: "ready",
      paymentAttemptAmountPaise: params.amountPaise,
      paymentStatus: "unpaid",
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
      paidAt: FieldValue.serverTimestamp(),
      refundId: null,
      refundedAmountPaise: null,
    },
    { merge: true },
  );

  return getOrderById(params.orderId);
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
}) {
  await adminDb().collection("orders").doc(params.orderId).set(
    {
      transferId: params.transferId ?? null,
      transferStatus: params.transferStatus,
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
    .filter(
      (order) =>
        order.transferStatus === "failed" ||
        order.transferStatus === "processing" ||
        order.transferStatus === "pending" ||
        order.paymentStatus === "refund_pending" ||
        order.paymentStatus === "refund_failed" ||
        (order.paymentStatus === "refunded" && order.transferStatus !== "reversed"),
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
}) {
  await adminDb().collection("razorpay_webhook_events").doc(params.eventId).set({
    eventId: params.eventId,
    eventName: params.eventName,
    processedAt: FieldValue.serverTimestamp(),
  });
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
