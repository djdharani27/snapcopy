import test from "node:test";
import assert from "node:assert/strict";

test("client payment verification patch is provisional and does not mark the order paid", async () => {
  const moduleUrl = new URL("./client-payment-verification.ts", import.meta.url).href;
  const { getClientReturnVerificationPatch } = await import(moduleUrl);

  const patch = getClientReturnVerificationPatch({
    razorpayOrderId: "order_123",
    razorpayPaymentId: "pay_123",
  });

  assert.equal(patch.paymentIntentStatus, "payment_verified_client_return");
  assert.equal(patch.razorpayOrderId, "order_123");
  assert.equal(patch.razorpayPaymentId, "pay_123");
  assert.equal("paymentStatus" in patch, false);
});
