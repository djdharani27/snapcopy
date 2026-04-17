import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import type {
  Order,
  OrderFile,
  OrderStatus,
  OrderWithFiles,
  Shop,
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
    paidAt: timestampToIso(data.paidAt),
  } as T;
}

function normalizeShop(shop: Shop): Shop {
  return {
    ...shop,
    googleMapsUrl: normalizeGoogleMapsUrl(
      (shop as Shop & { location?: string }).googleMapsUrl ||
        (shop as Shop & { location?: string }).location,
    ),
    services: Array.isArray(shop.services) ? shop.services : [],
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
    razorpayOrderId: order.razorpayOrderId || null,
    razorpayPaymentId: order.razorpayPaymentId || null,
    paidAt: order.paidAt || null,
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

export async function getAllShops() {
  const snapshot = await adminDb()
    .collection("shops")
    .orderBy("shopName", "asc")
    .get();

  return snapshot.docs.map((doc) => normalizeShop(mapDoc<Shop>(doc.id, doc.data())));
}

export async function getShopById(shopId: string) {
  const snapshot = await adminDb().collection("shops").doc(shopId).get();
  if (!snapshot.exists) return null;
  return normalizeShop(mapDoc<Shop>(snapshot.id, snapshot.data() ?? {}));
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
  shopName: string;
  address: string;
  googleMapsUrl?: string;
  phone: string;
  description: string;
  services: string[];
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
    shopName: params.shopName,
    address: params.address,
    googleMapsUrl: params.googleMapsUrl || "",
    phone: params.phone,
    description: params.description,
    services: params.services,
    pricing: params.pricing,
    createdAt: FieldValue.serverTimestamp(),
  });

  return getShopById(ref.id);
}

export async function updateShop(params: {
  shopId: string;
  ownerId: string;
  shopName: string;
  address: string;
  googleMapsUrl?: string;
  phone: string;
  description: string;
  services: string[];
  pricing: Shop["pricing"];
}) {
  const existing = await getShopById(params.shopId);
  if (!existing || existing.ownerId !== params.ownerId) {
    throw new Error("Shop not found.");
  }

  await adminDb().collection("shops").doc(params.shopId).set(
    {
      shopName: params.shopName,
      address: params.address,
      googleMapsUrl: params.googleMapsUrl || "",
      phone: params.phone,
      description: params.description,
      services: params.services,
      pricing: params.pricing,
    },
    { merge: true },
  );

  return getShopById(params.shopId);
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
  const sameShopOrdersSnapshot = await db
    .collection("orders")
    .where("shopId", "==", params.shopId)
    .get();
  const todaysOrderCount = sameShopOrdersSnapshot.docs.filter((doc) =>
    String(doc.data().trackingCode || "").startsWith(datePrefix),
  ).length;
  const nthOrder = String(todaysOrderCount + 1).padStart(3, "0");
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
    razorpayOrderId: null,
    razorpayPaymentId: null,
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
        const file = mapDoc<OrderFile>(doc.id, doc.data());
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
  await adminDb()
    .collection("orders")
    .doc(orderId)
    .set(
      {
        status,
        ...(finalAmount !== undefined ? { finalAmount } : {}),
      },
      { merge: true },
    );
  return getOrderById(orderId);
}

export async function prepareOrderPayment(params: {
  orderId: string;
  razorpayOrderId: string;
}) {
  await adminDb().collection("orders").doc(params.orderId).set(
    {
      razorpayOrderId: params.razorpayOrderId,
      paymentStatus: "unpaid",
    },
    { merge: true },
  );

  return getOrderById(params.orderId);
}

export async function markOrderPaid(params: {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
}) {
  await adminDb().collection("orders").doc(params.orderId).set(
    {
      paymentStatus: "paid",
      razorpayOrderId: params.razorpayOrderId,
      razorpayPaymentId: params.razorpayPaymentId,
      paidAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return getOrderById(params.orderId);
}

export async function getOrderFileById(fileId: string) {
  const snapshot = await adminDb().collection("order_files").doc(fileId).get();
  if (!snapshot.exists) return null;
  return mapDoc<OrderFile>(snapshot.id, snapshot.data() ?? {});
}
