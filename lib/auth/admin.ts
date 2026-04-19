import { notFound } from "next/navigation";
import { getCurrentToken, requireApiAuth } from "@/lib/auth/session";

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

export async function requireAdmin() {
  const decoded = await getCurrentToken();
  if (!decoded) {
    notFound();
  }

  if (!isAdminEmail(decoded.email)) {
    notFound();
  }

  return decoded;
}

export async function requireApiAdmin() {
  const decoded = await requireApiAuth();

  if (!isAdminEmail(decoded.email)) {
    throw new Error("Forbidden.");
  }

  return decoded;
}
