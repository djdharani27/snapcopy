import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/admin";

export async function POST(
  request: Request,
  context: { params: Promise<{ shopId: string }> },
) {
  await requireApiAdmin(request);
  await context.params;
  return NextResponse.json(
    {
      error: "Legacy Razorpay Route status sync has been disabled. Use manual linked-account onboarding only.",
    },
    { status: 410 },
  );
}
