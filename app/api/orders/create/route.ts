import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import { getOrderById, getShopById, prepareOrderPayment } from "@/lib/firebase/firestore-admin";
import { createRazorpayOrder, getRazorpayKeyId } from "@/lib/payments/razorpay";
import {
  canShopReceiveOnlinePayments,
  getShopPaymentUnavailableMessage,
} from "@/lib/payments/shop-readiness";

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

    if (order.status !== "completed") {
      return NextResponse.json(
        { error: "Payment is available only after the shop marks the order printed." },
        { status: 400 },
      );
    }

    if (!order.finalAmount || order.finalAmount <= 0) {
      return NextResponse.json(
        { error: "Final amount is not ready yet." },
        { status: 400 },
      );
    }

    if (order.paymentStatus === "paid") {
      return NextResponse.json({ error: "This order is already paid." }, { status: 400 });
    }

    const shop = await getShopById(order.shopId);

    if (!canShopReceiveOnlinePayments(shop)) {
      return NextResponse.json(
        { error: getShopPaymentUnavailableMessage() },
        { status: 400 },
      );
    }

    const razorpayOrder = await createRazorpayOrder({
      amountInPaise: Math.round(order.finalAmount * 100),
      receipt: `snapcopy-${order.id}`,
      notes: {
        orderId: order.id,
        shopId: order.shopId,
        customerId: order.customerId,
      },
    });

    await prepareOrderPayment({
      orderId: order.id,
      razorpayOrderId: razorpayOrder.id,
    });

    return NextResponse.json({
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: getRazorpayKeyId(),
      order,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create payment order." },
      { status: 400 },
    );
  }
}
