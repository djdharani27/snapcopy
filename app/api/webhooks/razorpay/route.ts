import { NextResponse } from "next/server";
import {
  getOrderByPaymentId,
  getOrderByRazorpayOrderId,
  getOrderByTransferId,
  hasProcessedWebhookEvent,
  markOrderPaid,
  markWebhookEventProcessed,
  updateOrderRefundState,
  updateOrderTransferState,
} from "@/lib/firebase/firestore-admin";
import { verifyRazorpayWebhookSignature } from "@/lib/payments/razorpay";
import { ensureOrderTransfer } from "@/lib/payments/transfers";

export const runtime = "nodejs";

function mapTransferStatus(eventName: string) {
  if (eventName === "transfer.processed") return "success" as const;
  if (eventName === "transfer.failed") return "failed" as const;
  if (eventName === "transfer.reversed") return "reversed" as const;
  return "pending" as const;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  const eventId = request.headers.get("x-razorpay-event-id");

  if (!signature) {
    return NextResponse.json({ error: "Missing Razorpay signature." }, { status: 400 });
  }

  if (!verifyRazorpayWebhookSignature({ rawBody, signature })) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  if (!eventId) {
    return NextResponse.json({ error: "Missing webhook event id." }, { status: 400 });
  }

  if (await hasProcessedWebhookEvent(eventId)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const payload = JSON.parse(rawBody) as {
    event: string;
    payload?: {
      payment?: {
        entity?: {
          id: string;
          order_id?: string | null;
        };
      };
      transfer?: {
        entity?: {
          id: string;
          status?: string;
          source?: string;
          recipient?: string;
          notes?: {
            orderId?: string;
            shopId?: string;
          };
        };
      };
      refund?: {
        entity?: {
          id: string;
          payment_id?: string | null;
          amount?: number | null;
          status?: string | null;
        };
      };
    };
  };

  try {
    if (payload.event === "payment.captured") {
      const paymentEntity = payload.payload?.payment?.entity;

      if (paymentEntity?.id) {
        let order = await getOrderByPaymentId(paymentEntity.id);

        if (!order && paymentEntity.order_id) {
          order = await getOrderByRazorpayOrderId(paymentEntity.order_id);
        }

        if (order) {
          if (order.paymentStatus !== "paid") {
            await markOrderPaid({
              orderId: order.id,
              razorpayOrderId: order.razorpayOrderId || paymentEntity.order_id || "",
              razorpayPaymentId: paymentEntity.id,
            });
          }

          await ensureOrderTransfer(order.id);
        }
      }
    }

    if (
      payload.event === "transfer.processed" ||
      payload.event === "transfer.failed" ||
      payload.event === "transfer.reversed"
    ) {
      const transferEntity = payload.payload?.transfer?.entity;

      if (transferEntity?.id) {
        let order = await getOrderByTransferId(transferEntity.id);

        if (!order && transferEntity.source) {
          const matchedOrder = await getOrderByPaymentId(transferEntity.source);
          if (
            matchedOrder &&
            (!transferEntity.notes?.orderId || transferEntity.notes.orderId === matchedOrder.id)
          ) {
            order = matchedOrder;
          }
        }

        if (order) {
          await updateOrderTransferState({
            orderId: order.id,
            transferId: transferEntity.id,
            transferStatus: mapTransferStatus(payload.event),
          });
        }
      }
    }

    if (
      payload.event === "refund.created" ||
      payload.event === "refund.processed" ||
      payload.event === "refund.failed"
    ) {
      const refundEntity = payload.payload?.refund?.entity;

      if (refundEntity?.payment_id) {
        const order = await getOrderByPaymentId(refundEntity.payment_id);

        if (order) {
          const nextPaymentStatus =
            payload.event === "refund.failed"
              ? "refund_failed"
              : payload.event === "refund.processed"
                ? "refunded"
                : "refund_pending";

          await updateOrderRefundState({
            orderId: order.id,
            paymentStatus: nextPaymentStatus,
            refundId: refundEntity.id,
            refundedAmountPaise: refundEntity.amount ?? null,
          });
        }
      }
    }

    await markWebhookEventProcessed({
      eventId,
      eventName: payload.event,
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Razorpay webhook handling failed", {
      eventId,
      event: payload.event,
      error: error instanceof Error ? error.message : error,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook handling failed." },
      { status: 500 },
    );
  }
}
