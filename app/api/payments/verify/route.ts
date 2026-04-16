import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import { getOrderById, markOrderPaid } from "@/lib/firebase/firestore-admin";
import { verifyRazorpaySignature } from "@/lib/payments/razorpay";

export async function POST(request: Request) {
  try {
    const { decoded } = await requireApiRole("customer");
    const {
      orderId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = await request.json();

    if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json(
        { error: "Missing payment verification payload." },
        { status: 400 },
      );
    }

    const order = await getOrderById(String(orderId));

    if (!order || order.customerId !== decoded.uid) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.paymentStatus === "paid") {
      return NextResponse.json({ order });
    }

    if (order.razorpayOrderId !== razorpayOrderId) {
      return NextResponse.json(
        { error: "Payment order mismatch." },
        { status: 400 },
      );
    }

    const isValid = verifyRazorpaySignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid Razorpay signature." },
        { status: 400 },
      );
    }

    const updatedOrder = await markOrderPaid({
      orderId: order.id,
      razorpayOrderId,
      razorpayPaymentId,
    });

    return NextResponse.json({ order: updatedOrder });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to verify payment." },
      { status: 400 },
    );
  }
}
