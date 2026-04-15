import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getAdminAuth } from "@/lib/firebase/admin";

export async function POST(request: Request) {
  const { token } = await request.json();

  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  try {
    await getAdminAuth().verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid token." }, { status: 401 });
  }

  (await cookies()).set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });

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
