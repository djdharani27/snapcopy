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
import { createRazorpayOrder, getRazorpayKeyId } from "@/lib/payments/razorpay";
import { calculateTransferBreakdown } from "@/lib/payments/transfer-calculation";
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

    if (order.paymentStatus === "quote_pending") {
      return NextResponse.json(
        { error: "The shop has not set a final payment amount for this order yet." },
        { status: 400 },
      );
    }

    if (!order.totalAmountPaise || order.totalAmountPaise <= 0 || !order.printCostPaise) {
      return NextResponse.json({ error: "Trusted order pricing is missing." }, { status: 400 });
    }

    if (order.paymentStatus === "paid") {
      return NextResponse.json({ error: "This order is already paid." }, { status: 400 });
    }

    if (order.paymentStatus !== "ready_to_pay" && order.paymentStatus !== "payment_failed" && order.paymentStatus !== "unpaid") {
      return NextResponse.json(
        { error: "This order is not ready for payment yet." },
        { status: 400 },
      );
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

    if (!shop.razorpayLinkedAccountId) {
      return NextResponse.json(
        { error: "Shop linked account is missing." },
        { status: 400 },
      );
    }

    const amountInPaise = order.totalAmountPaise;
    const billingConfig = await getBillingConfig();
    const transferBreakdown = calculateTransferBreakdown({
      amountPaise: amountInPaise,
      shopAmountPaise: order.shopEarningPaise ?? 0,
      estimatedRazorpayFeePercent: billingConfig.estimatedRazorpayFeePercent,
      estimatedGstPercent: billingConfig.estimatedGstPercent,
      transactionFeeEnabled: false,
    });
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
        pricing: {
          printCostPaise: order.printCostPaise,
          platformFeePaise: order.platformFeePaise,
          totalAmountPaise: order.totalAmountPaise,
        },
        order,
      });
    }

    const receipt = `sc-ord-${order.id.slice(-24)}`;
    let razorpayOrder;

    try {
      razorpayOrder = await createRazorpayOrder({
        amountInPaise,
        receipt,
        notes: {
          orderId: order.id,
          shopId: order.shopId,
          customerId: order.customerId,
          pageCount: String(order.pageCount || 0),
          copies: String(order.copies),
        },
        transfers: [
          {
            accountId: shop.razorpayLinkedAccountId,
            amountInPaise:
              order.transferableAmountPaise ?? transferBreakdown.transferableAmountPaise,
            notes: {
              orderId: order.id,
              shopId: order.shopId,
            },
          },
        ],
      });
    } catch (error) {
      await failOrderPaymentIntent(order.id);
      throw error;
    }

    await finalizeOrderPaymentIntent({
      orderId: order.id,
      razorpayOrderId: razorpayOrder.id,
      amountPaise: amountInPaise,
      linkedAccountId: shop.razorpayLinkedAccountId,
      transferableAmountPaise:
        order.transferableAmountPaise ?? transferBreakdown.transferableAmountPaise,
    });

    return NextResponse.json({
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: getRazorpayKeyId(),
      pricing: {
        printCostPaise: order.printCostPaise,
        platformFeePaise: order.platformFeePaise,
        totalAmountPaise: order.totalAmountPaise,
      },
      order,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create payment order." },
      { status: 400 },
    );
  }
}
