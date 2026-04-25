import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getAdminAuth } from "@/lib/firebase/admin";
import { getUserProfileById } from "@/lib/firebase/firestore-admin";
import type { UserProfile, UserRole } from "@/types";
import { ApiAuthError } from "@/lib/auth/errors";

export const SESSION_COOKIE_NAME = "firebase-session";

function parseCookieValue(cookieHeader: string | null, cookieName: string) {
  if (!cookieHeader) {
    return null;
  }

  const encodedName = encodeURIComponent(cookieName);
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${encodedName}=([^;]*)`),
  );

  if (!match) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

async function verifyFirebaseToken(token: string): Promise<DecodedIdToken | null> {
  try {
    return await getAdminAuth().verifyIdToken(token);
  } catch {
    try {
      return await getAdminAuth().verifySessionCookie(token, true);
    } catch {
      return null;
    }
  }
}

async function getTokenFromCookieStore() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  return verifyFirebaseToken(token);
}

async function getTokenFromRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : null;

  if (bearerToken) {
    const decoded = await verifyFirebaseToken(bearerToken);
    if (decoded) {
      return {
        decoded,
        source: "authorization" as const,
      };
    }
  }

  const cookieToken = parseCookieValue(request.headers.get("cookie"), SESSION_COOKIE_NAME);
  if (!cookieToken) {
    return null;
  }

  const decoded = await verifyFirebaseToken(cookieToken);
  if (!decoded) {
    return null;
  }

  return {
    decoded,
    source: "cookie" as const,
  };
}

export async function getCurrentToken(): Promise<DecodedIdToken | null> {
  return getTokenFromCookieStore();
}

export async function requireAuth() {
  const decoded = await getCurrentToken();
  if (!decoded) redirect("/login");
  return decoded;
}

export async function requireApiAuth(request?: Request) {
  const authState = request ? await getTokenFromRequest(request) : null;
  const decoded = authState?.decoded ?? (await getCurrentToken());

  if (!decoded) {
    throw new ApiAuthError("Not authenticated.", 401, "not_authenticated");
  }

  return {
    decoded,
    tokenSource: authState?.source ?? "cookie",
  };
}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const decoded = await getCurrentToken();
  if (!decoded) return null;
  return getUserProfileById(decoded.uid);
}

export async function requireRole(role: UserRole) {
  const decoded = await requireAuth();
  const profile = await getUserProfileById(decoded.uid);

  if (!profile) {
    redirect("/select-role");
  }

  if (profile.role !== role) {
    redirect(profile.role === "customer" ? "/customer/shops" : "/shop-owner/dashboard");
  }

  return { decoded, profile };
}

export async function requireApiRole(role: UserRole) {
  const { decoded } = await requireApiAuth();
  const profile = await getUserProfileById(decoded.uid);

  if (!profile) {
    throw new ApiAuthError("Role not selected.", 403, "role_not_selected");
  }

  if (profile.role !== role) {
    throw new ApiAuthError("Forbidden.", 403, "forbidden");
  }

  return { decoded, profile };
}
