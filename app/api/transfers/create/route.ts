import { NextResponse } from "next/server";
import { ApiAuthError } from "@/lib/auth/errors";
import { requireApiAdmin } from "@/lib/auth/admin";
import { syncOrderTransferState } from "@/lib/payments/transfers";

export async function POST(request: Request) {
  try {
    await requireApiAdmin(request);
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: "Order is required." }, { status: 400 });
    }

    const order = await syncOrderTransferState(String(orderId));
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to sync transfer." },
      { status: error instanceof ApiAuthError ? error.status : 400 },
    );
  }
}
