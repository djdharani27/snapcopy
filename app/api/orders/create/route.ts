import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import {
  beginOrderPaymentIntent,
  failOrderPaymentIntent,
  finalizeOrderPaymentIntent,
  getOrderById,
  getShopById,
} from "@/lib/firebase/firestore-admin";
import {
  canShopReceiveOnlinePayments,
  getShopPaymentUnavailableMessage,
} from "@/lib/payments/shop-readiness";
import { calculateTransferBreakdown } from "@/lib/payments/transfer-calculation";
import { createRazorpayOrder, getRazorpayKeyId } from "@/lib/payments/razorpay";
import { getBillingConfig } from "@/lib/platform/billing";

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

    if (!shop) {
      return NextResponse.json({ error: "Shop not found." }, { status: 404 });
    }

    if (!canShopReceiveOnlinePayments(shop)) {
      return NextResponse.json(
        { error: getShopPaymentUnavailableMessage(shop) },
        { status: 400 },
      );
    }

    const billingConfig = await getBillingConfig();
    const sellerAmountPaise = Math.round(order.finalAmount * 100);
    const customerPlatformFeePaise = billingConfig.transactionFeeEnabled
      ? billingConfig.transactionFeePaise
      : 0;
    const amountInPaise = sellerAmountPaise + customerPlatformFeePaise;
    const paymentIntent = await beginOrderPaymentIntent({
      orderId: order.id,
      amountPaise: amountInPaise,
    });

    if (paymentIntent.action === "paid") {
      return NextResponse.json({ error: "This order is already paid." }, { status: 400 });
    }

    if (paymentIntent.action === "creating") {
      return NextResponse.json(
        { error: "Payment is being prepared. Try again in a moment." },
        { status: 409 },
      );
    }

    if (paymentIntent.action === "reuse" && paymentIntent.razorpayOrderId) {
      return NextResponse.json({
        razorpayOrderId: paymentIntent.razorpayOrderId,
        amount: paymentIntent.amountPaise,
        currency: "INR",
        keyId: getRazorpayKeyId(),
        order,
      });
    }

    let razorpayOrder;

    try {
      const breakdown = calculateTransferBreakdown({
        amountPaise: amountInPaise,
        transactionFeePaise: billingConfig.transactionFeePaise,
        estimatedRazorpayFeePercent: billingConfig.estimatedRazorpayFeePercent,
        estimatedGstPercent: billingConfig.estimatedGstPercent,
        transactionFeeEnabled: billingConfig.transactionFeeEnabled,
      });

      razorpayOrder = await createRazorpayOrder({
        amountInPaise,
        receipt: `snapcopy-${order.id}`,
        notes: {
          orderId: order.id,
          shopId: order.shopId,
          customerId: order.customerId,
        },
        ...(breakdown.transferableAmountPaise > 0
          ? {
              transfers: [
                {
                  accountId: shop.razorpayLinkedAccountId!,
                  amountInPaise: breakdown.transferableAmountPaise,
                  notes: {
                    orderId: order.id,
                    shopId: order.shopId,
                  },
                  linkedAccountNotes: ["orderId", "shopId"],
                },
              ],
            }
          : {}),
      });

      await finalizeOrderPaymentIntent({
        orderId: order.id,
        razorpayOrderId: razorpayOrder.id,
        amountPaise: amountInPaise,
      });
    } catch (error) {
      if (razorpayOrder?.id) {
        try {
          await finalizeOrderPaymentIntent({
            orderId: order.id,
            razorpayOrderId: razorpayOrder.id,
            amountPaise: amountInPaise,
          });
        } catch {
          // Keep the original error and fall back to resetting the intent only if the remote
          // order was never persisted locally.
        }
      } else {
        await failOrderPaymentIntent(order.id);
      }

      throw error;
    }

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
