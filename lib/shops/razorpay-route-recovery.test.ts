import test from "node:test";
import assert from "node:assert/strict";

test("extractExistingLinkedAccountId recovers the exact Razorpay duplicate-email error shape", () => {
  // Node's test runner loads this file directly, so import the TS module via file URL.
  const moduleUrl = new URL("./razorpay-route-recovery.ts", import.meta.url).href;
  return import(moduleUrl).then(({ extractExistingLinkedAccountId }) => {
  const error = new Error("Merchant email already exists for account - SdtzQinPJ85sKL");

  assert.equal(
    extractExistingLinkedAccountId(error),
    "acc_SdtzQinPJ85sKL",
  );
  });
});

test("extractExistingLinkedAccountId also handles the raw payload description shape", () => {
  const moduleUrl = new URL("./razorpay-route-recovery.ts", import.meta.url).href;
  return import(moduleUrl).then(({ extractExistingLinkedAccountId }) => {
  const payload = {
    error: {
      description: "Merchant email already exists for account - SdtzQinPJ85sKL",
    },
  };

  assert.equal(
    extractExistingLinkedAccountId(payload.error.description),
    "acc_SdtzQinPJ85sKL",
  );
  });
});

test("duplicate-email recovery stops safely when recovered account verification returns Access Denied", () => {
  const moduleUrl = new URL("./razorpay-route-recovery.ts", import.meta.url).href;
  return import(moduleUrl).then(
    ({
      LINKED_ACCOUNT_RECOVERY_FAILED_MESSAGE,
      LINKED_ACCOUNT_RECOVERY_FAILED_STEP,
      recoverVerifiedLinkedAccount,
    }) => {
      return recoverVerifiedLinkedAccount({
        error: new Error("Merchant email already exists for account - SdtzQinPJ85sKL"),
        razorpayKeyId: "rzp_test_123456",
        verifyLinkedAccount: async () => {
          throw new Error("Access Denied");
        },
      }).then((result: Awaited<ReturnType<typeof recoverVerifiedLinkedAccount>>) => {
        assert.ok(result);
        assert.equal(result?.status, "verification_failed");
        assert.equal(result?.recoveredAccountId, "acc_SdtzQinPJ85sKL");
        assert.equal(result?.failureUpdate.razorpayLinkedAccountId, "");
        assert.equal(
          result?.failureUpdate.onboardingStep,
          LINKED_ACCOUNT_RECOVERY_FAILED_STEP,
        );
        assert.equal(
          result?.failureUpdate.onboardingError,
          LINKED_ACCOUNT_RECOVERY_FAILED_MESSAGE,
        );
      });
    },
  );
});
