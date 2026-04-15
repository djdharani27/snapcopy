import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getAdminAuth } from "@/lib/firebase/admin";
import { getUserProfileById } from "@/lib/firebase/firestore-admin";
import type { UserProfile, UserRole } from "@/types";

export const SESSION_COOKIE_NAME = "firebase-session";

export async function getCurrentToken(): Promise<DecodedIdToken | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;

  if (!token) return null;

  try {
    return await getAdminAuth().verifyIdToken(token);
  } catch {
    return null;
  }
}

export async function requireAuth() {
  const decoded = await getCurrentToken();
  if (!decoded) redirect("/login");
  return decoded;
}

export async function requireApiAuth() {
  const decoded = await getCurrentToken();
  if (!decoded) {
    throw new Error("Unauthorized.");
  }
  return decoded;
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
    redirect(profile.role === "customer" ? "/customer/dashboard" : "/shop-owner/dashboard");
  }

  return { decoded, profile };
}

export async function requireApiRole(role: UserRole) {
  const decoded = await requireApiAuth();
  const profile = await getUserProfileById(decoded.uid);

  if (!profile) {
    throw new Error("Role not selected.");
  }

  if (profile.role !== role) {
    throw new Error("Forbidden.");
  }

  return { decoded, profile };
}
