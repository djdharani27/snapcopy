import crypto from "crypto";

function assertRazorpayEnv() {
  const required = {
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value || String(value).includes("replace-me"))
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Missing Razorpay env vars: ${missing.join(", ")}. Add them to .env.local.`,
    );
  }
}

function assertRazorpayWebhookEnv() {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret || String(secret).includes("replace-me")) {
    throw new Error("Missing Razorpay webhook secret. Add RAZORPAY_WEBHOOK_SECRET to .env.local.");
  }
}

export function getRazorpayKeyId() {
  assertRazorpayEnv();
  return process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID as string;
}

function getRazorpayKeySecret() {
  assertRazorpayEnv();
  return process.env.RAZORPAY_KEY_SECRET as string;
}

function getRazorpayWebhookSecret() {
  assertRazorpayWebhookEnv();
  return process.env.RAZORPAY_WEBHOOK_SECRET as string;
}

function getRazorpayBasicAuthHeader() {
  return `Basic ${Buffer.from(
    `${getRazorpayKeyId()}:${getRazorpayKeySecret()}`,
  ).toString("base64")}`;
}

async function parseRazorpayResponse<T>(response: Response, fallbackMessage: string) {
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error?.description || fallbackMessage);
  }

  return payload as T;
}

export async function createRazorpayOrder(params: {
  amountInPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}) {
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: getRazorpayBasicAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: params.amountInPaise,
      currency: "INR",
      receipt: params.receipt,
      notes: params.notes,
    }),
  });

  return parseRazorpayResponse<{
    id: string;
    amount: number;
    currency: string;
    receipt: string;
    status: string;
  }>(response, "Unable to create Razorpay order.");
}

export async function fetchRazorpayPayment(paymentId: string) {
  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: {
      Authorization: getRazorpayBasicAuthHeader(),
      "Content-Type": "application/json",
    },
  });

  return parseRazorpayResponse<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    order_id: string | null;
    captured: boolean;
    fee: number | null;
    tax: number | null;
  }>(response, "Unable to fetch Razorpay payment.");
}

export async function createRazorpayPaymentTransfer(params: {
  paymentId: string;
  accountId: string;
  amountInPaise: number;
  notes?: Record<string, string>;
  linkedAccountNotes?: string[];
}) {
  const response = await fetch(
    `https://api.razorpay.com/v1/payments/${params.paymentId}/transfers`,
    {
      method: "POST",
      headers: {
        Authorization: getRazorpayBasicAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transfers: [
          {
            account: params.accountId,
            amount: params.amountInPaise,
            currency: "INR",
            notes: params.notes,
            ...(params.linkedAccountNotes?.length
              ? { linked_account_notes: params.linkedAccountNotes }
              : {}),
          },
        ],
      }),
    },
  );

  const payload = await parseRazorpayResponse<{
    items?: Array<{
      id: string;
      status: string;
      recipient: string;
      amount: number;
      currency: string;
      source: string;
    }>;
  }>(response, "Unable to create Razorpay transfer.");

  const transfer = payload.items?.[0];

  if (!transfer) {
    throw new Error("Razorpay did not return a transfer.");
  }

  return transfer;
}

export async function createRazorpayLinkedAccount(params: {
  email: string;
  phone: string;
  legalBusinessName: string;
  contactName: string;
  referenceId: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  businessType?: string;
  description?: string;
}) {
  const response = await fetch("https://api.razorpay.com/v2/accounts", {
    method: "POST",
    headers: {
      Authorization: getRazorpayBasicAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      phone: params.phone,
      type: "route",
      reference_id: params.referenceId,
      legal_business_name: params.legalBusinessName,
      customer_facing_business_name: params.legalBusinessName,
      business_type: params.businessType || "proprietorship",
      contact_name: params.contactName,
      profile: {
        business_model: params.description || "Local print and document services",
        addresses: {
          registered: {
            street1: params.address,
            city: params.city,
            state: params.state.toUpperCase(),
            postal_code: params.postalCode,
            country: "IN",
          },
        },
      },
    }),
  });

  return parseRazorpayResponse<{
    id: string;
    type: "route";
    status: string;
    email: string;
    phone: string;
    contact_name: string;
    reference_id: string;
    business_type: string;
    legal_business_name: string;
    customer_facing_business_name?: string;
  }>(response, "Unable to create Razorpay linked account.");
}

export function verifyRazorpaySignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  const expected = crypto
    .createHmac("sha256", getRazorpayKeySecret())
    .update(`${params.razorpayOrderId}|${params.razorpayPaymentId}`)
    .digest("hex");

  return expected === params.razorpaySignature;
}

export function verifyRazorpayWebhookSignature(params: {
  rawBody: string;
  signature: string;
}) {
  const expected = crypto
    .createHmac("sha256", getRazorpayWebhookSecret())
    .update(params.rawBody)
    .digest("hex");

  return expected === params.signature;
}
