import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/session";
import { upsertUserProfile } from "@/lib/firebase/firestore-admin";
import { USER_ROLES } from "@/lib/utils/constants";
import type { UserRole } from "@/types";

export async function POST(request: Request) {
  try {
    const { decoded } = await requireApiAuth(request);
    const { role } = await request.json();

    if (!USER_ROLES.includes(role)) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }

    const profile = await upsertUserProfile({
      uid: decoded.uid,
      name: decoded.name || "Unnamed user",
      email: decoded.email || "",
      role: role as UserRole,
    });

    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized." },
      { status: 401 },
    );
  }
}
