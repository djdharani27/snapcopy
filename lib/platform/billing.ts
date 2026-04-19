import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import type { BillingAuditLog, BillingConfig } from "@/types";

const BILLING_SETTINGS_COLLECTION = "platform_settings";
const BILLING_SETTINGS_DOC = "billing";
const BILLING_AUDIT_COLLECTION = "platform_settings_audit";

function getNumberFromEnv(name: string, fallback: number) {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number(rawValue);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : fallback;
}

export const DEFAULT_BILLING_CONFIG: BillingConfig = {
  shopCreationFeePaise: getNumberFromEnv("PLATFORM_SHOP_CREATION_FEE_PAISE", 4900),
  transactionFeePaise: getNumberFromEnv("PLATFORM_TRANSACTION_FEE_PAISE", 100),
  estimatedRazorpayFeePercent: getNumberFromEnv("RAZORPAY_ESTIMATED_FEE_PERCENT", 2),
  estimatedGstPercent: getNumberFromEnv("RAZORPAY_ESTIMATED_GST_PERCENT", 18),
  shopCreationFeeEnabled: true,
  transactionFeeEnabled: true,
  updatedAt: null,
  updatedBy: null,
};

function timestampToIso(value: unknown) {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  return null;
}

function normalizeNumber(value: unknown, fallback: number) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeBillingConfig(
  value?: Partial<BillingConfig> | null,
): BillingConfig {
  return {
    shopCreationFeePaise: normalizeNumber(
      value?.shopCreationFeePaise,
      DEFAULT_BILLING_CONFIG.shopCreationFeePaise,
    ),
    transactionFeePaise: normalizeNumber(
      value?.transactionFeePaise,
      DEFAULT_BILLING_CONFIG.transactionFeePaise,
    ),
    estimatedRazorpayFeePercent: normalizeNumber(
      value?.estimatedRazorpayFeePercent,
      DEFAULT_BILLING_CONFIG.estimatedRazorpayFeePercent,
    ),
    estimatedGstPercent: normalizeNumber(
      value?.estimatedGstPercent,
      DEFAULT_BILLING_CONFIG.estimatedGstPercent,
    ),
    shopCreationFeeEnabled: normalizeBoolean(
      value?.shopCreationFeeEnabled,
      DEFAULT_BILLING_CONFIG.shopCreationFeeEnabled,
    ),
    transactionFeeEnabled: normalizeBoolean(
      value?.transactionFeeEnabled,
      DEFAULT_BILLING_CONFIG.transactionFeeEnabled,
    ),
    updatedAt:
      typeof value?.updatedAt === "string"
        ? value.updatedAt
        : timestampToIso((value as { updatedAt?: unknown } | undefined)?.updatedAt),
    updatedBy: String(value?.updatedBy || ""),
  };
}

export async function getBillingConfig() {
  const snapshot = await getAdminDb()
    .collection(BILLING_SETTINGS_COLLECTION)
    .doc(BILLING_SETTINGS_DOC)
    .get();

  if (!snapshot.exists) {
    return DEFAULT_BILLING_CONFIG;
  }

  return normalizeBillingConfig(snapshot.data() as Partial<BillingConfig>);
}

export async function updateBillingConfig(params: {
  actorUid: string;
  actorEmail: string;
  config: BillingConfig;
  action?: string;
}) {
  const db = getAdminDb();
  const ref = db.collection(BILLING_SETTINGS_COLLECTION).doc(BILLING_SETTINGS_DOC);
  const nextConfig = normalizeBillingConfig(params.config);
  const previousConfig = await getBillingConfig();

  await ref.set(
    {
      ...nextConfig,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: params.actorEmail,
    },
    { merge: true },
  );

  await db.collection(BILLING_AUDIT_COLLECTION).add({
    actorEmail: params.actorEmail,
    actorUid: params.actorUid,
    action: params.action || "updated",
    before: previousConfig,
    after: nextConfig,
    createdAt: FieldValue.serverTimestamp(),
  });

  return getBillingConfig();
}

export async function getBillingAuditLogs(limit = 10) {
  const snapshot = await getAdminDb()
    .collection(BILLING_AUDIT_COLLECTION)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();

    return {
      id: doc.id,
      actorEmail: String(data.actorEmail || ""),
      actorUid: String(data.actorUid || ""),
      action: String(data.action || "updated"),
      before: normalizeBillingConfig(data.before as Partial<BillingConfig>),
      after: normalizeBillingConfig(data.after as Partial<BillingConfig>),
      createdAt: timestampToIso(data.createdAt),
    } satisfies BillingAuditLog;
  });
}

export async function getTransactionFeePaise() {
  const config = await getBillingConfig();
  return config.transactionFeeEnabled ? config.transactionFeePaise : 0;
}

export async function getShopCreationFeePaise() {
  const config = await getBillingConfig();
  return config.shopCreationFeeEnabled ? config.shopCreationFeePaise : 0;
}
