import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import { getOrderById, markOrderPaid } from "@/lib/firebase/firestore-admin";
import { verifyRazorpaySignature } from "@/lib/payments/razorpay";
import { ensureOrderTransfer } from "@/lib/payments/transfers";

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
      try {
        const transferredOrder = await ensureOrderTransfer(order.id);
        return NextResponse.json({ order: transferredOrder });
      } catch (transferError) {
        console.error("Transfer retry after paid order failed", {
          orderId: order.id,
          error: transferError instanceof Error ? transferError.message : transferError,
        });

        return NextResponse.json({
          order,
          transferError:
            transferError instanceof Error ? transferError.message : "Transfer creation failed.",
        });
      }
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

    console.info("Razorpay payment verified", {
      orderId: order.id,
      razorpayPaymentId,
    });

    try {
      const transferredOrder = await ensureOrderTransfer(updatedOrder?.id || order.id);
      return NextResponse.json({ order: transferredOrder });
    } catch (transferError) {
      console.error("Transfer creation after payment verification failed", {
        orderId: order.id,
        error: transferError instanceof Error ? transferError.message : transferError,
      });

      return NextResponse.json({
        order: updatedOrder,
        transferError:
          transferError instanceof Error ? transferError.message : "Transfer creation failed.",
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to verify payment." },
      { status: 400 },
    );
  }
}
