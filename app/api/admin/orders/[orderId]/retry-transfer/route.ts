import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/admin";
import { getOrderById } from "@/lib/firebase/firestore-admin";
import { ensureOrderTransfer } from "@/lib/payments/transfers";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/admin/orders/[orderId]/retry-transfer">,
) {
  try {
    await requireApiAdmin();
    const { orderId } = await context.params;
    const order = await getOrderById(orderId);

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const updatedOrder = await ensureOrderTransfer(order.id);
    return NextResponse.json({ order: updatedOrder });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to retry transfer." },
      { status: 400 },
    );
  }
}
