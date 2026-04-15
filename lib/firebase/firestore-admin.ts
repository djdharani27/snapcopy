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

function mapDoc<T>(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    ...data,
    createdAt: timestampToIso(data.createdAt),
  } as T;
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
}) {
  const ref = adminDb().collection("users").doc(params.uid);
  const snapshot = await ref.get();

  await ref.set(
    {
      uid: params.uid,
      name: params.name,
      email: params.email,
      role: params.role,
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

  return snapshot.docs.map((doc) => mapDoc<Shop>(doc.id, doc.data()));
}

export async function getShopById(shopId: string) {
  const snapshot = await adminDb().collection("shops").doc(shopId).get();
  if (!snapshot.exists) return null;
  return mapDoc<Shop>(snapshot.id, snapshot.data() ?? {});
}

export async function getShopByOwnerId(ownerId: string) {
  const snapshot = await adminDb()
    .collection("shops")
    .where("ownerId", "==", ownerId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return mapDoc<Shop>(doc.id, doc.data());
}

export async function createShop(params: {
  ownerId: string;
  shopName: string;
  address: string;
  phone: string;
  description: string;
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
    phone: params.phone,
    description: params.description,
    createdAt: FieldValue.serverTimestamp(),
  });

  return getShopById(ref.id);
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

  batch.set(orderRef, {
    id: orderRef.id,
    customerId: params.customerId,
    shopId: params.shopId,
    customerName: params.customerName,
    customerPhone: params.customerPhone,
    notes: params.notes,
    printType: params.printType,
    sideType: params.sideType,
    copies: params.copies,
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
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

  const order = mapDoc<Order>(snapshot.id, snapshot.data() ?? {});
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
    .map((doc) => mapDoc<Order>(doc.id, doc.data()))
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

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  await adminDb().collection("orders").doc(orderId).set({ status }, { merge: true });
  return getOrderById(orderId);
}

export async function getOrderFileById(fileId: string) {
  const snapshot = await adminDb().collection("order_files").doc(fileId).get();
  if (!snapshot.exists) return null;
  return mapDoc<OrderFile>(snapshot.id, snapshot.data() ?? {});
}
