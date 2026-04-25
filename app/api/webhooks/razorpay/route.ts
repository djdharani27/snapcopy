import { NextResponse } from "next/server";
import {
  getShopByLinkedAccountId,
  getOrderByPaymentId,
  getOrderByRazorpayOrderId,
  getOrderByTransferId,
  hasProcessedWebhookEvent,
  markOrderPaid,
  markOrderPaymentFailed,
  markWebhookEventProcessed,
  updateShopRazorpayStatus,
  updateOrderRefundState,
  updateOrderTransferState,
} from "@/lib/firebase/firestore-admin";
import {
  buildRouteWebhookStatusUpdate,
  getTransferWebhookOrderId,
  isDuplicateWebhookEventProcessed,
  mapRouteRequirements,
} from "@/lib/payments/route-webhook-state";
import { verifyRazorpayWebhookSignature } from "@/lib/payments/razorpay";
import { syncOrderTransferState } from "@/lib/payments/transfers";

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

  if (isDuplicateWebhookEventProcessed(await hasProcessedWebhookEvent(eventId))) {
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
      order?: {
        entity?: {
          id: string;
        };
      };
      transfer?: {
        entity?: {
          id: string;
          source?: string;
          recipient?: string;
          status?: string;
          amount?: number;
          processed_at?: number | null;
          error?: {
            description?: string | null;
            reason?: string | null;
          };
          notes?: {
            orderId?: string;
          };
        };
      };
      merchant_product?: {
        entity?: {
          id?: string;
          merchant_id?: string;
          activation_status?: string;
        };
        data?: {
          requirements?: Array<{
            field_reference?: string;
            resolution_url?: string;
            reason_code?: string;
            status?: string;
          }>;
        };
      };
      refund?: {
        entity?: {
          id: string;
          payment_id?: string | null;
          amount?: number | null;
        };
      };
      account?: {
        entity?: {
          id?: string;
          status?: string;
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

        if (order && order.paymentStatus !== "paid") {
          await markOrderPaid({
            orderId: order.id,
            razorpayOrderId: order.razorpayOrderId || paymentEntity.order_id || "",
            razorpayPaymentId: paymentEntity.id,
          });
        }

        if (order) {
          await syncOrderTransferState(order.id);
        }
      }
    }

    if (payload.event === "payment.failed") {
      const paymentEntity = payload.payload?.payment?.entity;

      if (paymentEntity?.id) {
        let order = await getOrderByPaymentId(paymentEntity.id);

        if (!order && paymentEntity.order_id) {
          order = await getOrderByRazorpayOrderId(paymentEntity.order_id);
        }

        if (order && order.paymentStatus !== "paid") {
          await markOrderPaymentFailed({
            orderId: order.id,
            razorpayOrderId: order.razorpayOrderId || paymentEntity.order_id || null,
            razorpayPaymentId: paymentEntity.id,
          });
        }
      }
    }

    if (payload.event === "order.paid") {
      const orderEntity = payload.payload?.order?.entity;
      const paymentEntity = payload.payload?.payment?.entity;

      if (orderEntity?.id && paymentEntity?.id) {
        const order = await getOrderByRazorpayOrderId(orderEntity.id);

        if (order && order.paymentStatus !== "paid") {
          await markOrderPaid({
            orderId: order.id,
            razorpayOrderId: orderEntity.id,
            razorpayPaymentId: paymentEntity.id,
          });
        }

        if (order) {
          await syncOrderTransferState(order.id);
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
            const razorpayOrderId = getTransferWebhookOrderId(transferEntity.source);
            const matchedOrder = razorpayOrderId
              ? await getOrderByRazorpayOrderId(razorpayOrderId)
              : null;
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
            transferFailureReason:
              payload.event === "transfer.failed"
                ? [
                    String(transferEntity.error?.description || "").trim(),
                    String(transferEntity.error?.reason || "").trim(),
                  ]
                    .filter(Boolean)
                    .join(" - ")
                : null,
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

    if (payload.event === "account.updated") {
      console.info("Razorpay linked account updated", {
        accountId: payload.payload?.account?.entity?.id || null,
        status: payload.payload?.account?.entity?.status || null,
      });
    }

    if (
      payload.event === "product.route.activated" ||
      payload.event === "product.route.under_review" ||
      payload.event === "product.route.needs_clarification" ||
      payload.event === "product.route.suspended"
    ) {
      const merchantProduct = payload.payload?.merchant_product;
      const accountId = String(merchantProduct?.entity?.merchant_id || "").trim();
      const activationStatus = String(merchantProduct?.entity?.activation_status || "").trim();

      if (accountId && activationStatus) {
        const shop = await getShopByLinkedAccountId(accountId);

        if (shop) {
          const requirements = mapRouteRequirements(merchantProduct?.data?.requirements);
          const routeStatusUpdate = buildRouteWebhookStatusUpdate({
            activationStatus,
            requirements,
          });

          await updateShopRazorpayStatus({
            shopId: shop.id,
            razorpayProductStatus: routeStatusUpdate.razorpayProductStatus,
            razorpayProductRequirements: routeStatusUpdate.razorpayProductRequirements,
            razorpayProductResolutionUrl: routeStatusUpdate.razorpayProductResolutionUrl,
            paymentBlockedReason: routeStatusUpdate.paymentBlockedReason,
            isActive: routeStatusUpdate.isAcceptingOrders,
          });
        }
      }
    }

    await markWebhookEventProcessed({
      eventId,
      eventName: payload.event,
      payloadJson: rawBody,
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
