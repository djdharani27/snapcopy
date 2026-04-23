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

function getRazorpayRouteBusinessProfile(params: {
  businessCategory?: string;
  businessSubcategory?: string;
}) {
  const category =
    params.businessCategory?.trim() || process.env.RAZORPAY_ROUTE_BUSINESS_CATEGORY?.trim();
  const subcategory =
    params.businessSubcategory?.trim() || process.env.RAZORPAY_ROUTE_BUSINESS_SUBCATEGORY?.trim();

  if (!category || !subcategory) {
    throw new Error(
      "Missing Razorpay Route business profile. Set RAZORPAY_ROUTE_BUSINESS_CATEGORY and RAZORPAY_ROUTE_BUSINESS_SUBCATEGORY to a valid Razorpay category/subcategory pair from the Route docs.",
    );
  }

  return { category, subcategory };
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
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  businessType?: string;
  businessCategory?: string;
  businessSubcategory?: string;
  description?: string;
  pan?: string;
}) {
  const businessType = (params.businessType || "individual").trim().toLowerCase();
  const usesStakeholderPanOnly = ["individual", "proprietorship"].includes(businessType);
  const businessProfile = getRazorpayRouteBusinessProfile({
    businessCategory: params.businessCategory,
    businessSubcategory: params.businessSubcategory,
  });

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
      business_type: businessType,
      contact_name: params.contactName,
      profile: {
        category: businessProfile.category,
        subcategory: businessProfile.subcategory,
        business_model: params.description || "Local print and document services",
        addresses: {
          registered: {
            street1: params.address,
            street2: params.addressLine2 || params.address,
            city: params.city,
            state: params.state.toUpperCase(),
            postal_code: params.postalCode,
            country: "IN",
          },
        },
      },
      ...(params.pan && !usesStakeholderPanOnly
        ? {
            legal_info: {
              pan: params.pan,
            },
          }
        : {}),
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

export async function fetchRazorpayLinkedAccount(accountId: string) {
  const response = await fetch(`https://api.razorpay.com/v2/accounts/${accountId}`, {
    headers: {
      Authorization: getRazorpayBasicAuthHeader(),
      "Content-Type": "application/json",
    },
  });

  return parseRazorpayResponse<{
    id: string;
    type: "route";
    status: string;
    email: string;
    phone: string | number;
    reference_id?: string;
  }>(response, "Unable to fetch Razorpay linked account.");
}

export async function createRazorpayStakeholder(params: {
  accountId: string;
  name: string;
  email: string;
  phone: string;
  pan: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
}) {
  const response = await fetch(
    `https://api.razorpay.com/v2/accounts/${params.accountId}/stakeholders`,
    {
      method: "POST",
      headers: {
        Authorization: getRazorpayBasicAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: params.name,
        email: params.email,
        relationship: {
          director: true,
          executive: true,
        },
        percentage_ownership: 100,
        phone: {
          primary: Number(params.phone),
        },
        addresses: {
          residential: {
            street: params.address,
            city: params.city,
            state: params.state.toUpperCase(),
            postal_code: params.postalCode,
            country: "IN",
          },
        },
        kyc: {
          pan: params.pan,
        },
      }),
    },
  );

  return parseRazorpayResponse<{
    id: string;
    entity: "stakeholder";
    name: string;
    email: string;
    kyc?: {
      pan?: string;
    };
  }>(response, "Unable to create Razorpay stakeholder.");
}

export async function requestRazorpayRouteProductConfiguration(params: {
  accountId: string;
  tncAccepted: boolean;
}) {
  const response = await fetch(`https://api.razorpay.com/v2/accounts/${params.accountId}/products`, {
    method: "POST",
    headers: {
      Authorization: getRazorpayBasicAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      product_name: "route",
      tnc_accepted: params.tncAccepted,
    }),
  });

  return parseRazorpayResponse<{
    id: string;
    product_name: "route" | "Route";
    activation_status: string;
  }>(response, "Unable to request Razorpay Route product configuration.");
}

export async function updateRazorpayRouteProductConfiguration(params: {
  accountId: string;
  productId: string;
  accountNumber: string;
  ifscCode: string;
  beneficiaryName: string;
  tncAccepted: boolean;
}) {
  const response = await fetch(
    `https://api.razorpay.com/v2/accounts/${params.accountId}/products/${params.productId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: getRazorpayBasicAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        settlements: {
          account_number: params.accountNumber,
          ifsc_code: params.ifscCode,
          beneficiary_name: params.beneficiaryName,
        },
        tnc_accepted: params.tncAccepted,
      }),
    },
  );

  return parseRazorpayResponse<{
    requested_configuration?: unknown;
    active_configuration?: {
      settlements?: {
        account_number?: string;
        ifsc_code?: string;
        beneficiary_name?: string;
      };
    };
    requirements?: Array<{
      field_reference?: string;
      resolution_url?: string;
      reason_code?: string;
      status?: string;
    }>;
    tnc?: {
      accepted?: boolean;
      accepted_at?: number;
    };
    id: string;
    product_name: "route" | "Route";
    activation_status: string;
    account_id: string;
  }>(response, "Unable to update Razorpay Route settlement configuration.");
}

export async function fetchRazorpayRouteProductConfiguration(params: {
  accountId: string;
  productId: string;
}) {
  const response = await fetch(
    `https://api.razorpay.com/v2/accounts/${params.accountId}/products/${params.productId}`,
    {
      headers: {
        Authorization: getRazorpayBasicAuthHeader(),
        "Content-Type": "application/json",
      },
    },
  );

  return parseRazorpayResponse<{
    requested_configuration?: unknown;
    active_configuration?: unknown;
    requirements?: Array<{
      field_reference?: string;
      resolution_url?: string;
      reason_code?: string;
      status?: string;
    }>;
    id: string;
    product_name: "route" | "Route";
    activation_status: string;
    account_id: string;
  }>(response, "Unable to fetch Razorpay Route product configuration.");
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
