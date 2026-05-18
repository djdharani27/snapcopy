import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getAdminAuth } from "@/lib/firebase/admin";
import {
  createFirebaseSessionCookie,
  SESSION_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/auth/session-cookie";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { token } = await request.json();

  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  try {
    const auth = getAdminAuth();
    const sessionCookie = await createFirebaseSessionCookie(token, auth);

    (await cookies()).set({
      name: SESSION_COOKIE_NAME,
      value: sessionCookie,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    });
  } catch {
    return NextResponse.json({ error: "Invalid token." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  (await cookies()).set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return NextResponse.json({ ok: true });
}
