import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import { getOrderById } from "@/lib/firebase/firestore-admin";
import { ensureOrderTransfer } from "@/lib/payments/transfers";

export async function POST(request: Request) {
  try {
    const { decoded } = await requireApiRole("customer");
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: "Order is required." }, { status: 400 });
    }

    const order = await getOrderById(String(orderId));

    if (!order || order.customerId !== decoded.uid) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const updatedOrder = await ensureOrderTransfer(order.id);
    return NextResponse.json({ order: updatedOrder });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create transfer." },
      { status: 400 },
    );
  }
}
