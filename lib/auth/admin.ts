import { notFound } from "next/navigation";
import { ApiAuthError } from "@/lib/auth/errors";
import { getCurrentToken, requireApiAuth } from "@/lib/auth/session";
import { getUserProfileById } from "@/lib/firebase/firestore-admin";

function getAdminEmails() {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null) {
  if (!email) {
    return false;
  }

  return getAdminEmails().includes(email.trim().toLowerCase());
}

async function resolveAdminAccess(decoded: Awaited<ReturnType<typeof getCurrentToken>>) {
  if (!decoded) {
    return {
      profile: null,
      isAdmin: false,
      isAdminByEmail: false,
      isAdminByRole: false,
      detectedRole: null,
    };
  }

  const profile = await getUserProfileById(decoded.uid);
  const detectedRole = profile?.role || null;
  const isAdminByRole = detectedRole === "admin";
  const isAdminByEmail = isAdminEmail(decoded.email);

  return {
    profile,
    isAdmin: isAdminByRole || isAdminByEmail,
    isAdminByEmail,
    isAdminByRole,
    detectedRole,
  };
}

function logAdminDecision(params: {
  route: string;
  uid?: string | null;
  email?: string | null;
  detectedRole?: string | null;
  tokenSource?: string | null;
  allowed: boolean;
  reason: string;
  isAdminByEmail?: boolean;
  isAdminByRole?: boolean;
}) {
  const payload = {
    route: params.route,
    uid: params.uid || null,
    email: params.email || null,
    detectedRole: params.detectedRole || null,
    tokenSource: params.tokenSource || null,
    allowed: params.allowed,
    reason: params.reason,
    isAdminByRole: Boolean(params.isAdminByRole),
    isAdminByEmail: Boolean(params.isAdminByEmail),
  };

  if (params.allowed) {
    console.info("[AdminAuth] Access granted", payload);
    return;
  }

  console.warn("[AdminAuth] Access denied", payload);
}

export async function requireAdmin() {
  const decoded = await getCurrentToken();
  if (!decoded) {
    logAdminDecision({
      route: "/admin",
      allowed: false,
      reason: "not_authenticated",
    });
    notFound();
  }

  const access = await resolveAdminAccess(decoded);

  if (!access.isAdmin) {
    logAdminDecision({
      route: "/admin",
      uid: decoded.uid,
      email: decoded.email,
      detectedRole: access.detectedRole,
      allowed: false,
      reason: access.profile ? "not_admin" : "user_profile_missing",
      isAdminByEmail: access.isAdminByEmail,
      isAdminByRole: access.isAdminByRole,
    });
    notFound();
  }

  logAdminDecision({
    route: "/admin",
    uid: decoded.uid,
    email: decoded.email,
    detectedRole: access.isAdminByRole ? access.detectedRole : access.detectedRole || "admin",
    allowed: true,
    reason: access.isAdminByRole ? "admin_role" : "admin_email_allowlist",
    isAdminByEmail: access.isAdminByEmail,
    isAdminByRole: access.isAdminByRole,
  });

  return decoded;
}

export async function requireApiAdmin(request: Request, route?: string) {
  const currentRoute = route || new URL(request.url).pathname;
  let authResult: Awaited<ReturnType<typeof requireApiAuth>>;

  try {
    authResult = await requireApiAuth(request);
  } catch (error) {
    if (error instanceof ApiAuthError) {
      logAdminDecision({
        route: currentRoute,
        allowed: false,
        reason: error.reason,
      });
    }

    throw error;
  }

  const { decoded, tokenSource } = authResult;
  const access = await resolveAdminAccess(decoded);

  if (!access.profile && !access.isAdminByEmail) {
    logAdminDecision({
      route: currentRoute,
      uid: decoded.uid,
      email: decoded.email,
      detectedRole: null,
      tokenSource,
      allowed: false,
      reason: "user_profile_missing",
      isAdminByEmail: access.isAdminByEmail,
      isAdminByRole: access.isAdminByRole,
    });
    throw new ApiAuthError("Not admin.", 403, "user_profile_missing");
  }

  if (!access.isAdmin) {
    logAdminDecision({
      route: currentRoute,
      uid: decoded.uid,
      email: decoded.email,
      detectedRole: access.detectedRole,
      tokenSource,
      allowed: false,
      reason: "not_admin",
      isAdminByEmail: access.isAdminByEmail,
      isAdminByRole: access.isAdminByRole,
    });
    throw new ApiAuthError("Not admin.", 403, "not_admin");
  }

  logAdminDecision({
    route: currentRoute,
    uid: decoded.uid,
    email: decoded.email,
    detectedRole: access.isAdminByRole ? access.detectedRole : access.detectedRole || "admin",
    tokenSource,
    allowed: true,
    reason: access.isAdminByRole ? "admin_role" : "admin_email_allowlist",
    isAdminByEmail: access.isAdminByEmail,
    isAdminByRole: access.isAdminByRole,
  });

  return {
    decoded,
    profile: access.profile,
    tokenSource,
    adminSource: access.isAdminByRole ? "role" : "email",
  };
}
