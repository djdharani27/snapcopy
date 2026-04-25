import { NextResponse } from "next/server";
import { ApiAuthError } from "@/lib/auth/errors";
import { requireApiAdmin } from "@/lib/auth/admin";
import { getOrderById, markOrderSettlementPaid } from "@/lib/firebase/firestore-admin";

export async function POST(
  request: Request,
  context: RouteContext<"/api/admin/orders/[orderId]/settlement">,
) {
  try {
    await requireApiAdmin(request);
    const { orderId } = await context.params;
    const order = await getOrderById(orderId);

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.paymentStatus !== "paid") {
      return NextResponse.json({ error: "Only paid orders can be settled." }, { status: 400 });
    }

    const updatedOrder = await markOrderSettlementPaid(orderId);
    return NextResponse.json({ order: updatedOrder });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to mark settlement paid." },
      { status: error instanceof ApiAuthError ? error.status : 400 },
    );
  }
}
