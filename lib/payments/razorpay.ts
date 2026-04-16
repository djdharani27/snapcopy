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

export function getRazorpayKeyId() {
  assertRazorpayEnv();
  return process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID as string;
}

function getRazorpayKeySecret() {
  assertRazorpayEnv();
  return process.env.RAZORPAY_KEY_SECRET as string;
}

export async function createRazorpayOrder(params: {
  amountInPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}) {
  const credentials = Buffer.from(
    `${getRazorpayKeyId()}:${getRazorpayKeySecret()}`,
  ).toString("base64");

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: params.amountInPaise,
      currency: "INR",
      receipt: params.receipt,
      notes: params.notes,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error?.description || "Unable to create Razorpay order.");
  }

  return payload as {
    id: string;
    amount: number;
    currency: string;
    receipt: string;
    status: string;
  };
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
