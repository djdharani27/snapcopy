import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/session";

export async function POST() {
  await requireApiRole("shop_owner");
  return NextResponse.json(
    {
      error: "Legacy Razorpay Route status sync has been disabled. Use manual linked-account onboarding only.",
    },
    { status: 410 },
  );
}
