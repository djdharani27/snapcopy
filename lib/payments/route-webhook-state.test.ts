import test from "node:test";
import assert from "node:assert/strict";

test("transfer.processed correlation uses razorpay_order_id source", async () => {
  const moduleUrl = new URL("./route-webhook-state.ts", import.meta.url).href;
  const { getTransferWebhookOrderId } = await import(moduleUrl);

  assert.equal(getTransferWebhookOrderId("order_Q123"), "order_Q123");
});

test("transfer.failed state is classified as admin-visible attention", async () => {
  const moduleUrl = new URL("./route-webhook-state.ts", import.meta.url).href;
  const { isTransferAttentionOrder } = await import(moduleUrl);

  assert.equal(
    isTransferAttentionOrder({
      paymentStatus: "paid",
      transferStatus: "failed",
    }),
    true,
  );
});

test("product.route.activated only enables checkout when requirements are resolved", async () => {
  const moduleUrl = new URL("./route-webhook-state.ts", import.meta.url).href;
  const { buildRouteWebhookStatusUpdate } = await import(moduleUrl);

  const activatedWithBlockingRequirement = buildRouteWebhookStatusUpdate({
    activationStatus: "activated",
    requirements: [
      {
        fieldReference: "settlements.account_number",
        resolutionUrl: "/accounts/acc_123/products/acc_prd_123",
        reasonCode: "needs_clarification",
        status: "required",
      },
    ],
  });

  assert.equal(activatedWithBlockingRequirement.razorpayProductStatus, "activated");
  assert.equal(activatedWithBlockingRequirement.isAcceptingOrders, false);
  assert.match(
    activatedWithBlockingRequirement.paymentBlockedReason,
    /Route requirements pending/i,
  );

  const fullyActivated = buildRouteWebhookStatusUpdate({
    activationStatus: "activated",
    requirements: [
      {
        fieldReference: "settlements.account_number",
        resolutionUrl: "/accounts/acc_123/products/acc_prd_123",
        reasonCode: "resolved",
        status: "resolved",
      },
    ],
  });

  assert.equal(fullyActivated.isAcceptingOrders, true);
  assert.equal(fullyActivated.paymentBlockedReason, "");
});

test("duplicate webhook event is skipped idempotently", async () => {
  const moduleUrl = new URL("./route-webhook-state.ts", import.meta.url).href;
  const { isDuplicateWebhookEventProcessed } = await import(moduleUrl);

  assert.equal(isDuplicateWebhookEventProcessed(true), true);
  assert.equal(isDuplicateWebhookEventProcessed(false), false);
});
