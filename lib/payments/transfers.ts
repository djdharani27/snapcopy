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

export async function syncOrderTransferState(orderId: string) {
  const order = await getOrderById(orderId);

  if (!order) {
    throw new Error("Order not found.");
  }

  if (order.paymentStatus !== "paid" || !order.razorpayPaymentId || !order.totalAmountPaise) {
    throw new Error("Transfer state can only be synced after payment is marked as paid.");
  }

  const shop = await getShopById(order.shopId);

  if (!shop?.razorpayLinkedAccountId) {
    throw new Error("Shop linked account is missing.");
  }

  const payment = await fetchRazorpayPayment(order.razorpayPaymentId);

  if (!payment.captured || payment.status !== "captured") {
    throw new Error("Payment has not been captured yet.");
  }

  await updateOrderTransferSnapshot({
    orderId: order.id,
    linkedAccountId: shop.razorpayLinkedAccountId,
    platformTransactionFeePaise: 0,
    estimatedFeePaise: payment.fee ?? 0,
    estimatedTaxPaise: payment.tax ?? 0,
    gatewayFeeSource: payment.fee === null ? null : "actual",
    transferableAmountPaise: order.shopEarningPaise ?? order.totalAmountPaise,
  });

  const transfers = await fetchRazorpayPaymentTransfers(payment.id);
  const transfer = transfers.items?.find((item) => item.recipient === shop.razorpayLinkedAccountId);

  if (!transfer) {
    await updateOrderTransferState({
      orderId: order.id,
      transferStatus: "processing",
    });
    return getOrderById(order.id);
  }

  await updateOrderTransferState({
    orderId: order.id,
    transferId: transfer.id,
    transferStatus: mapTransferStatus(transfer.status),
  });

  return getOrderById(order.id);
}
