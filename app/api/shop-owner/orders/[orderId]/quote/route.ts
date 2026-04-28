import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import {
  getOrderById,
  getShopByOwnerId,
  setOrderQuotedPricing,
} from "@/lib/firebase/firestore-admin";
import { calculateQuotedOrderPricing } from "@/lib/payments/order-pricing";
import { calculateTransferBreakdown } from "@/lib/payments/transfer-calculation";
import { getBillingConfig } from "@/lib/platform/billing";
import { formatRupeesToPaise } from "@/lib/utils/format";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  try {
    const { decoded } = await requireApiRole("shop_owner");
    const { orderId } = await context.params;
    const { amountRupees } = await request.json();

    const numericAmountRupees = Number(amountRupees);

    if (!Number.isFinite(numericAmountRupees)) {
      return NextResponse.json({ error: "Amount must be numeric." }, { status: 400 });
    }

    if (numericAmountRupees <= 0) {
      return NextResponse.json({ error: "Amount must be greater than 0." }, { status: 400 });
    }

    const shop = await getShopByOwnerId(decoded.uid);
    const order = await getOrderById(orderId);

    if (!shop || !order || order.shopId !== shop.id) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.paymentStatus === "paid") {
      return NextResponse.json(
        { error: "Paid orders cannot be repriced." },
        { status: 400 },
      );
    }

    if (
      order.paymentStatus === "refund_pending" ||
      order.paymentStatus === "refunded" ||
      order.paymentStatus === "refund_failed"
    ) {
      return NextResponse.json(
        { error: "Refunded orders cannot be repriced." },
        { status: 400 },
      );
    }

    const pricing = calculateQuotedOrderPricing(formatRupeesToPaise(numericAmountRupees));
    const billingConfig = await getBillingConfig();
    const transferBreakdown = calculateTransferBreakdown({
      amountPaise: pricing.totalAmountPaise,
      shopAmountPaise: pricing.shopEarningPaise,
      estimatedRazorpayFeePercent: billingConfig.estimatedRazorpayFeePercent,
      estimatedGstPercent: billingConfig.estimatedGstPercent,
      transactionFeeEnabled: false,
    });
    const updatedOrder = await setOrderQuotedPricing({
      orderId: order.id,
      ownerId: decoded.uid,
      pricing,
      transferBreakdown,
    });

    return NextResponse.json({
      order: updatedOrder,
      message: "Payment amount saved. Customer can pay now.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save payment amount." },
      { status: 400 },
    );
  }
}
