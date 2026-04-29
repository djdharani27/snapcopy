import crypto from "crypto";

function isInvalidEnvValue(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  return (
    !normalized ||
    normalized === "undefined" ||
    normalized === "null" ||
    normalized.includes("replace-me")
  );
}

function isDevelopmentEnvironment() {
  return process.env.NODE_ENV !== "production";
}

function getPreferredEnvValue(primaryKey: string, developmentFallbackKey?: string) {
  if (developmentFallbackKey && isDevelopmentEnvironment()) {
    const developmentValue = process.env[developmentFallbackKey];

    if (!isInvalidEnvValue(developmentValue)) {
      return developmentValue as string;
    }
  }

  const primaryValue = process.env[primaryKey];

  if (!isInvalidEnvValue(primaryValue)) {
    return primaryValue as string;
  }

  return null;
}

function normalizeRazorpayPhone(value: string) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }

  return digits;
}

function assertRazorpayEnv() {
  const required = {
    keyId: getPreferredEnvValue("RAZORPAY_KEY_ID", "RAZORPAY_TEST_KEY_ID"),
    keySecret: getPreferredEnvValue("RAZORPAY_KEY_SECRET", "RAZORPAY_TEST_KEY_SECRET"),
  };

  const missing = Object.entries(required)
    .filter(([, value]) => isInvalidEnvValue(value))
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Missing Razorpay env vars: ${missing.join(", ")}. Add them to .env.local.`,
    );
  }
}

function assertRazorpayWebhookEnv() {
  const secret = getPreferredEnvValue(
    "RAZORPAY_WEBHOOK_SECRET",
    "RAZORPAY_TEST_WEBHOOK_SECRET",
  );

  if (isInvalidEnvValue(secret)) {
    throw new Error("Missing Razorpay webhook secret. Add RAZORPAY_WEBHOOK_SECRET to .env.local.");
  }
}

export function getRazorpayKeyId() {
  const publicKeyId = getPreferredEnvValue(
    "NEXT_PUBLIC_RAZORPAY_KEY_ID",
    "NEXT_PUBLIC_RAZORPAY_TEST_KEY_ID",
  );
  const serverKeyId = getPreferredEnvValue("RAZORPAY_KEY_ID", "RAZORPAY_TEST_KEY_ID");

  if (
    !isInvalidEnvValue(publicKeyId) &&
    !isInvalidEnvValue(serverKeyId) &&
    publicKeyId !== serverKeyId
  ) {
    throw new Error(
      "Razorpay public checkout key does not match the server API key. Make NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_ID use the same Razorpay account.",
    );
  }

  if (!isInvalidEnvValue(publicKeyId)) {
    return publicKeyId;
  }

  return getServerRazorpayKeyId();
}

function getServerRazorpayKeyId() {
  assertRazorpayEnv();
  return getPreferredEnvValue("RAZORPAY_KEY_ID", "RAZORPAY_TEST_KEY_ID") as string;
}

function getRazorpayKeySecret() {
  assertRazorpayEnv();
  return getPreferredEnvValue("RAZORPAY_KEY_SECRET", "RAZORPAY_TEST_KEY_SECRET") as string;
}

function getRazorpayWebhookSecret() {
  assertRazorpayWebhookEnv();
  return getPreferredEnvValue(
    "RAZORPAY_WEBHOOK_SECRET",
    "RAZORPAY_TEST_WEBHOOK_SECRET",
  ) as string;
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
    `${getServerRazorpayKeyId()}:${getRazorpayKeySecret()}`,
  ).toString("base64")}`;
}

function getRazorpayLogPayload(init?: RequestInit) {
  if (!init?.body || typeof init.body !== "string") {
    return null;
  }

  try {
    const payload = JSON.parse(init.body);

    const redactSecrets = (value: unknown): unknown => {
      if (Array.isArray(value)) {
        return value.map(redactSecrets);
      }

      if (!value || typeof value !== "object") {
        return value;
      }

      return Object.fromEntries(
        Object.entries(value).map(([key, nestedValue]) => {
          const normalizedKey = key.toLowerCase();

          if (["account_number", "pan"].includes(normalizedKey)) {
            return [key, "[REDACTED]"];
          }

          return [key, redactSecrets(nestedValue)];
        }),
      );
    };

    return redactSecrets(payload);
  } catch {
    return init.body;
  }
}

async function razorpayApiFetch(path: string, init?: RequestInit) {
  const method = init?.method || "GET";
  const url = `https://api.razorpay.com${path}`;
  const requestPayload = getRazorpayLogPayload(init);

  console.info("[Razorpay API] Request", {
    method,
    url: path,
    body: requestPayload,
  });

  const response = await fetch(url, init);
  const responseClone = response.clone();
  const responseText = await responseClone.text();
  let responsePayload: unknown = responseText;

  try {
    responsePayload = responseText ? JSON.parse(responseText) : null;
  } catch {
    responsePayload = responseText;
  }

  console.info("[Razorpay API] Response", {
    method,
    url: path,
    status: response.status,
    ok: response.ok,
    body: responsePayload,
  });

  return response;
}

async function parseRazorpayResponse<T>(response: Response, fallbackMessage: string) {
  const payload = await response.json();

  if (!response.ok) {
    const errorCode = String(payload?.error?.code || "").trim();
    const errorDescription = String(payload?.error?.description || "").trim();
    const errorStep = String(payload?.error?.step || "").trim();

    if (
      fallbackMessage === "Unable to create Razorpay order." &&
      errorCode === "BAD_REQUEST_ERROR" &&
      errorDescription === "The id provided does not exist" &&
      errorStep === "payment_initiation"
    ) {
      throw new Error(
        "This shop's Razorpay linked account is invalid or belongs to a different platform account. Reconnect shop payments and try again.",
      );
    }

    throw new Error(payload.error?.description || fallbackMessage);
  }

  return payload as T;
}

export async function createRazorpayOrder(params: {
  amountInPaise: number;
  receipt: string;
  notes?: Record<string, string>;
  transfers?: Array<{
    accountId: string;
    amountInPaise: number;
    notes?: Record<string, string>;
    linkedAccountNotes?: string[];
  }>;
}) {
  const response = await razorpayApiFetch("/v1/orders", {
    method: "POST",
    headers: {
      Authorization: getRazorpayBasicAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: params.amountInPaise,
      currency: "INR",
      receipt: params.receipt,
      partial_payment: false,
      notes: params.notes,
      ...(params.transfers?.length
        ? {
            transfers: params.transfers.map((transfer) => ({
              account: transfer.accountId,
              amount: transfer.amountInPaise,
              currency: "INR",
              notes: transfer.notes,
              ...(transfer.linkedAccountNotes?.length
                ? { linked_account_notes: transfer.linkedAccountNotes }
                : {}),
            })),
          }
        : {}),
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
  const response = await razorpayApiFetch(`/v1/payments/${paymentId}`, {
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

export async function fetchRazorpayPaymentTransfers(paymentId: string) {
  const response = await razorpayApiFetch(`/v1/payments/${paymentId}/transfers`, {
    headers: {
      Authorization: getRazorpayBasicAuthHeader(),
      "Content-Type": "application/json",
    },
  });

  return parseRazorpayResponse<{
    items?: Array<{
      id: string;
      status: string;
      recipient: string;
      amount: number;
      currency: string;
      source: string;
      notes?: Record<string, string>;
    }>;
  }>(response, "Unable to fetch Razorpay payment transfers.");
}

export async function createRazorpayPaymentTransfer(params: {
  paymentId: string;
  accountId: string;
  amountInPaise: number;
  notes?: Record<string, string>;
  linkedAccountNotes?: string[];
}) {
  const response = await razorpayApiFetch(`/v1/payments/${params.paymentId}/transfers`, {
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
  });

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
  const normalizedPhone = normalizeRazorpayPhone(params.phone);
  const usesStakeholderPanOnly = ["individual", "proprietorship"].includes(businessType);
  const businessProfile = getRazorpayRouteBusinessProfile({
    businessCategory: params.businessCategory,
    businessSubcategory: params.businessSubcategory,
  });

  console.log("Razorpay settlement email:", params.email);

  const response = await razorpayApiFetch("/v2/accounts", {
    method: "POST",
    headers: {
      Authorization: getRazorpayBasicAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      phone: Number(normalizedPhone),
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
    status_details?: {
      reason?: string;
      description?: string;
    };
  }>(response, "Unable to create Razorpay linked account.");
}

export async function fetchRazorpayLinkedAccount(accountId: string) {
  const response = await razorpayApiFetch(`/v2/accounts/${accountId}`, {
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
    status_details?: {
      reason?: string;
      description?: string;
    };
  }>(response, "Unable to fetch Razorpay linked account.");
}

export async function updateRazorpayLinkedAccount(params: {
  accountId: string;
  phone: string;
  legalBusinessName: string;
  contactName: string;
  address: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  description?: string;
}) {
  const normalizedPhone = normalizeRazorpayPhone(params.phone);

  const response = await razorpayApiFetch(`/v2/accounts/${params.accountId}`, {
    method: "PATCH",
    headers: {
      Authorization: getRazorpayBasicAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone: Number(normalizedPhone),
      legal_business_name: params.legalBusinessName,
      customer_facing_business_name: params.legalBusinessName,
      contact_name: params.contactName,
      profile: {
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
    }),
  });

  return parseRazorpayResponse<{
    id: string;
    type: "route";
    status: string;
    email: string;
    phone: string | number;
    reference_id?: string;
    status_details?: {
      reason?: string;
      description?: string;
    };
  }>(response, "Unable to update Razorpay linked account.");
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
  const normalizedPhone = normalizeRazorpayPhone(params.phone);
  const response = await razorpayApiFetch(`/v2/accounts/${params.accountId}/stakeholders`, {
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
        primary: normalizedPhone,
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
  });

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

export async function fetchRazorpayStakeholder(params: {
  accountId: string;
  stakeholderId: string;
}) {
  const response = await razorpayApiFetch(
    `/v2/accounts/${params.accountId}/stakeholders/${params.stakeholderId}`,
    {
      headers: {
        Authorization: getRazorpayBasicAuthHeader(),
        "Content-Type": "application/json",
      },
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
  }>(response, "Unable to fetch Razorpay stakeholder.");
}

export async function fetchAllRazorpayStakeholders(accountId: string) {
  const response = await razorpayApiFetch(`/v2/accounts/${accountId}/stakeholders`, {
    headers: {
      Authorization: getRazorpayBasicAuthHeader(),
      "Content-Type": "application/json",
    },
  });

  return parseRazorpayResponse<{
    items?: Array<{
      id: string;
      entity: "stakeholder";
      name?: string;
      email?: string;
      kyc?: {
        pan?: string;
      };
    }>;
  }>(response, "Unable to fetch Razorpay stakeholders.");
}

export async function requestRazorpayRouteProductConfiguration(params: {
  accountId: string;
  tncAccepted: boolean;
}) {
  const response = await razorpayApiFetch(`/v2/accounts/${params.accountId}/products`, {
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
  const sanitizedAccountNumber = String(params.accountNumber || "").replace(/\s/g, "");
  const sanitizedIfscCode = String(params.ifscCode || "").trim().toUpperCase();
  const sanitizedBeneficiaryName = String(params.beneficiaryName || "").trim();

  if (!/^\d{5,20}$/.test(sanitizedAccountNumber)) {
    throw new Error(
      "Settlement bank account number is required before Route product configuration can be submitted.",
    );
  }

  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(sanitizedIfscCode)) {
    throw new Error(
      "Settlement IFSC is required before Route product configuration can be submitted.",
    );
  }

  if (!sanitizedBeneficiaryName) {
    throw new Error(
      "Settlement beneficiary name is required before Route product configuration can be submitted.",
    );
  }

  console.info("[Razorpay Route Product] Settlement config preflight", {
    account_id: params.accountId,
    product_id: params.productId,
    has_beneficiary_name: Boolean(sanitizedBeneficiaryName),
    has_ifsc_code: Boolean(sanitizedIfscCode),
    has_full_account_number: Boolean(sanitizedAccountNumber),
    account_number_last4: sanitizedAccountNumber.slice(-4),
  });

  const response = await razorpayApiFetch(
    `/v2/accounts/${params.accountId}/products/${params.productId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: getRazorpayBasicAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        settlements: {
          account_number: sanitizedAccountNumber,
          ifsc_code: sanitizedIfscCode,
          beneficiary_name: sanitizedBeneficiaryName,
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
  const response = await razorpayApiFetch(
    `/v2/accounts/${params.accountId}/products/${params.productId}`,
    {
      headers: {
        Authorization: getRazorpayBasicAuthHeader(),
        "Content-Type": "application/json",
      },
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
    id: string;
    product_name: "route" | "Route";
    activation_status: string;
    account_id: string;
    tnc?: {
      accepted?: boolean;
      accepted_at?: number;
    };
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
