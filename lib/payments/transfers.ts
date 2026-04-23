import {
  claimOrderTransferCreation,
  getOrderById,
  getShopById,
  updateOrderTransferSnapshot,
  updateOrderTransferState,
} from "@/lib/firebase/firestore-admin";
import { createRazorpayPaymentTransfer, fetchRazorpayPayment } from "@/lib/payments/razorpay";
import { calculateTransferBreakdown } from "@/lib/payments/transfer-calculation";
import { getBillingConfig } from "@/lib/platform/billing";

function mapTransferStatus(status: string) {
  switch (status) {
    case "processed":
      return "success" as const;
    case "failed":
      return "failed" as const;
    case "pending":
      return "pending" as const;
    default:
      return "processing" as const;
  }
}

export async function ensureOrderTransfer(orderId: string) {
  const order = await getOrderById(orderId);

  if (!order) {
    throw new Error("Order not found.");
  }

  if (order.transferId || order.transferStatus === "success") {
    return order;
  }

  if (order.paymentStatus !== "paid" || !order.razorpayPaymentId) {
    throw new Error("Transfer can be created only after payment is marked as paid.");
  }

  if (!order.finalAmount || order.finalAmount <= 0) {
    throw new Error("Final amount is missing.");
  }

  const shop = await getShopById(order.shopId);

  if (!shop?.razorpayLinkedAccountId) {
    throw new Error("Shop linked account is missing.");
  }

  const payment = await fetchRazorpayPayment(order.razorpayPaymentId);

  if (!payment.captured || payment.status !== "captured") {
    throw new Error("Payment has not been captured yet.");
  }

  const billingConfig = await getBillingConfig();
  const breakdown = calculateTransferBreakdown({
    amountPaise: payment.amount,
    transactionFeePaise: billingConfig.transactionFeePaise,
    estimatedRazorpayFeePercent: billingConfig.estimatedRazorpayFeePercent,
    estimatedGstPercent: billingConfig.estimatedGstPercent,
    transactionFeeEnabled: billingConfig.transactionFeeEnabled,
    actualFeePaise: payment.fee,
    actualTaxPaise: payment.tax,
  });

  await updateOrderTransferSnapshot({
      orderId: order.id,
      linkedAccountId: shop.razorpayLinkedAccountId,
      ...breakdown,
  });

  const claimed = await claimOrderTransferCreation(order.id);

  if (!claimed) {
    return getOrderById(order.id);
  }

  if (breakdown.transferableAmountPaise === 0) {
    await updateOrderTransferState({
      orderId: order.id,
      transferStatus: "success",
    });

    console.info("No transfer created because payout was fully consumed by configured fees", {
      orderId: order.id,
      paymentId: payment.id,
    });

    return getOrderById(order.id);
  }

  try {
    console.info("Razorpay payment verified; creating transfer", {
      orderId: order.id,
      paymentId: payment.id,
    });

    const transfer = await createRazorpayPaymentTransfer({
      paymentId: payment.id,
      accountId: shop.razorpayLinkedAccountId,
      amountInPaise: breakdown.transferableAmountPaise,
      notes: {
        orderId: order.id,
        shopId: order.shopId,
      },
      linkedAccountNotes: ["orderId", "shopId"],
    });

    await updateOrderTransferState({
      orderId: order.id,
      transferId: transfer.id,
      transferStatus: mapTransferStatus(transfer.status),
    });

    console.info("Razorpay transfer created", {
      orderId: order.id,
      transferId: transfer.id,
      transferStatus: transfer.status,
    });
  } catch (error) {
    await updateOrderTransferState({
      orderId: order.id,
      transferStatus: "failed",
    });

    console.error("Razorpay transfer failed", {
      orderId: order.id,
      paymentId: order.razorpayPaymentId,
      error: error instanceof Error ? error.message : error,
    });

    throw error;
  }

  return getOrderById(order.id);
}
