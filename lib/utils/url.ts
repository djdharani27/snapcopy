export function normalizeAppUrl(value?: string | null) {
  return String(value || "").trim().replace(/\/+$/, "");
}

export function normalizeInternalPath(value?: string | null, fallback = "") {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue.startsWith("/")) {
    return fallback;
  }

  if (normalizedValue.startsWith("//")) {
    return fallback;
  }

  return normalizedValue;
}

export function getConfiguredAppUrl() {
  return normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL);
}

export function buildShopShareUrl(shopId: string, fallbackOrigin?: string) {
  const baseUrl = getConfiguredAppUrl() || normalizeAppUrl(fallbackOrigin);
  if (!baseUrl) {
    return `/s/${shopId}`;
  }

  return `${baseUrl}/s/${shopId}`;
}
