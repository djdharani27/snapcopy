import { NextResponse } from "next/server";
import { ApiAuthError } from "@/lib/auth/errors";
import { requireApiAdmin } from "@/lib/auth/admin";
import { syncOrderTransferState } from "@/lib/payments/transfers";

export async function POST(
  request: Request,
  context: RouteContext<"/api/admin/orders/[orderId]/retry-transfer">,
) {
  try {
    await requireApiAdmin(request);
    const { orderId } = await context.params;
    const order = await syncOrderTransferState(orderId);
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to retry transfer." },
      { status: error instanceof ApiAuthError ? error.status : 400 },
    );
  }
}
