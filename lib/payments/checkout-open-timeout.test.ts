import test from "node:test";
import assert from "node:assert/strict";

test("flags a timeout only while checkout is still in the opening state", async () => {
  const moduleUrl = new URL("./checkout-open-timeout.ts", import.meta.url).href;
  const { shouldMarkCheckoutOpenTimeout } = await import(moduleUrl);

  assert.equal(
    shouldMarkCheckoutOpenTimeout({
      checkoutWasOpened: false,
      checkoutWasDismissed: false,
      paymentVerificationStarted: false,
    }),
    false,
  );

  assert.equal(
    shouldMarkCheckoutOpenTimeout({
      checkoutWasOpened: true,
      checkoutWasDismissed: false,
      paymentVerificationStarted: false,
    }),
    true,
  );

  assert.equal(
    shouldMarkCheckoutOpenTimeout({
      checkoutWasOpened: true,
      checkoutWasDismissed: false,
      paymentVerificationStarted: true,
    }),
    false,
  );

  assert.equal(
    shouldMarkCheckoutOpenTimeout({
      checkoutWasOpened: true,
      checkoutWasDismissed: true,
      paymentVerificationStarted: false,
    }),
    false,
  );
});
