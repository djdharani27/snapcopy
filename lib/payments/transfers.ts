import {
  getOrderById,
  getShopById,
  updateOrderTransferSnapshot,
  updateOrderTransferState,
} from "@/lib/firebase/firestore-admin";
import {
  fetchRazorpayPayment,
  fetchRazorpayPaymentTransfers,
} from "@/lib/payments/razorpay";
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

  if (breakdown.transferableAmountPaise === 0) {
    await updateOrderTransferState({
      orderId: order.id,
      transferStatus: "success",
    });

    console.info("No seller transfer is required because the payout amount is zero", {
      orderId: order.id,
      paymentId: payment.id,
    });

    return getOrderById(order.id);
  }

  try {
    const transfers = await fetchRazorpayPaymentTransfers(payment.id);
    const transfer = transfers.items?.find(
      (item) => item.recipient === shop.razorpayLinkedAccountId,
    );

    if (transfer) {
      await updateOrderTransferState({
        orderId: order.id,
        transferId: transfer.id,
        transferStatus: mapTransferStatus(transfer.status),
      });

      console.info("Synced Razorpay Route transfer from payment", {
        orderId: order.id,
        transferId: transfer.id,
        transferStatus: transfer.status,
      });
    } else if (!order.transferId || order.transferStatus === "not_created") {
      await updateOrderTransferState({
        orderId: order.id,
        transferStatus: "processing",
      });
    }
  } catch (error) {
    await updateOrderTransferState({
      orderId: order.id,
      transferStatus: "failed",
    });

    console.error("Razorpay Route transfer sync failed", {
      orderId: order.id,
      paymentId: order.razorpayPaymentId,
      error: error instanceof Error ? error.message : error,
    });

    throw error;
  }

  return getOrderById(order.id);
}
