export function parseServices(value: unknown) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parsePrice(value: unknown) {
  const numericValue = Number(value);
  if (Number.isNaN(numericValue) || numericValue < 0) {
    throw new Error("Pricing values must be valid non-negative numbers.");
  }

  return numericValue;
}

export function parseGoogleMapsUrl(value: unknown) {
  const trimmedValue = String(value || "").trim();
  if (!trimmedValue) {
    return "";
  }

  let url: URL;
  try {
    url = new URL(trimmedValue);
  } catch {
    throw new Error("Enter a valid Google Maps link.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Enter a valid Google Maps link.");
  }

  const hostname = url.hostname.toLowerCase();
  if (!hostname.includes("google.") && !hostname.includes("maps.app.goo.gl")) {
    throw new Error("Use a Google Maps share link.");
  }

  return trimmedValue;
}

export function parseRazorpayLinkedAccountId(value: unknown) {
  const trimmedValue = String(value || "").trim();

  if (!trimmedValue) {
    throw new Error("Razorpay linked account id is required.");
  }

  if (!/^acc_[A-Za-z0-9]+$/.test(trimmedValue)) {
    throw new Error("Enter a valid Razorpay linked account id.");
  }

  return trimmedValue;
}

export function parsePhone(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.length < 8 || digits.length > 15) {
    throw new Error("Enter a valid phone number.");
  }

  return digits;
}

export function parseEmail(value: unknown, field = "Email") {
  const trimmedValue = String(value || "").trim().toLowerCase();

  if (!trimmedValue) {
    throw new Error(`${field} is required.`);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)) {
    throw new Error(`Enter a valid ${field.toLowerCase()}.`);
  }

  return trimmedValue;
}

export function parseRequiredText(value: unknown, field: string) {
  const trimmedValue = String(value || "").trim();

  if (!trimmedValue) {
    throw new Error(`${field} is required.`);
  }

  return trimmedValue;
}

export function parsePostalCode(value: unknown) {
  const trimmedValue = String(value || "").trim();

  if (!/^\d{6}$/.test(trimmedValue)) {
    throw new Error("Enter a valid 6-digit pincode.");
  }

  return trimmedValue;
}

export function parseIfsc(value: unknown) {
  const trimmedValue = String(value || "").trim().toUpperCase();

  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(trimmedValue)) {
    throw new Error("Enter a valid IFSC code.");
  }

  return trimmedValue;
}

export function parsePan(value: unknown) {
  const trimmedValue = String(value || "").trim().toUpperCase();

  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(trimmedValue)) {
    throw new Error("Enter a valid PAN.");
  }

  return trimmedValue;
}

export function parseAcceptedTerms(value: unknown, label: string) {
  const normalizedValue = String(value || "").trim().toLowerCase();

  if (!["true", "on", "yes", "1"].includes(normalizedValue)) {
    throw new Error(label);
  }

  return true;
}

export function parseBankAccountNumber(value: unknown) {
  const trimmedValue = String(value || "").replace(/\s/g, "");

  if (!/^\d{5,20}$/.test(trimmedValue)) {
    throw new Error("Enter a valid bank account number.");
  }

  return trimmedValue;
}

export function maskBankAccount(accountNumber: string) {
  return accountNumber.slice(-4);
}

export function maskPan(pan: string) {
  return pan.slice(-4);
}
