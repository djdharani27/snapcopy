import { NextResponse } from "next/server";
import { ApiAuthError } from "@/lib/auth/errors";
import { requireApiRole } from "@/lib/auth/session";
import {
  getOrderById,
  markOrderPaymentVerifiedClientReturn,
} from "@/lib/firebase/firestore-admin";
import { fetchRazorpayPayment, verifyRazorpaySignature } from "@/lib/payments/razorpay";

export const runtime = "nodejs";

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

    const existingRazorpayOrderId = String(order.razorpayOrderId || "");

    const isValid = verifyRazorpaySignature({
      razorpayOrderId: existingRazorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid Razorpay signature." },
        { status: 400 },
      );
    }

    const payment = await fetchRazorpayPayment(razorpayPaymentId);

    if (payment.order_id !== razorpayOrderId) {
      return NextResponse.json({ error: "Razorpay payment/order mismatch." }, { status: 400 });
    }

    if (payment.amount !== order.totalAmountPaise) {
      return NextResponse.json({ error: "Razorpay amount mismatch." }, { status: 400 });
    }

    if (!payment.captured || payment.status !== "captured") {
      return NextResponse.json(
        { error: "Razorpay payment is not captured yet." },
        { status: 400 },
      );
    }

    const updatedOrder = await markOrderPaymentVerifiedClientReturn({
      orderId: order.id,
      razorpayOrderId,
      razorpayPaymentId,
    });

    console.info("Razorpay payment verified", {
      orderId: order.id,
      razorpayPaymentId,
      status: "payment_verified_client_return",
    });

    return NextResponse.json({ order: updatedOrder });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to verify payment." },
      { status: error instanceof ApiAuthError ? error.status : 400 },
    );
  }
}
