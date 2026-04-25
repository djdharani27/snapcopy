"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useState } from "react";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

export function PaySubscriptionButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "starting" | "verifying">("idle");

  async function handlePay() {
    if (state !== "idle") {
      return;
    }

    setState("starting");

    try {
      const response = await fetch("/api/shop-subscriptions/create", {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to start subscription payment.");
      }

      if (!window.Razorpay) {
        throw new Error("Razorpay checkout failed to load.");
      }

      const razorpay = new window.Razorpay({
        key: payload.keyId,
        amount: payload.amount,
        currency: payload.currency,
        name: "SnapCopy",
        description: "Shop activation payment",
        order_id: payload.razorpayOrderId,
        handler: async (result: Record<string, string>) => {
          setState("verifying");

          try {
            const verifyResponse = await fetch("/api/shop-subscriptions/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpayOrderId: result.razorpay_order_id,
                razorpayPaymentId: result.razorpay_payment_id,
                razorpaySignature: result.razorpay_signature,
              }),
            });
            const verifyPayload = await verifyResponse.json();

            if (!verifyResponse.ok) {
              throw new Error(verifyPayload.error || "Subscription verification failed.");
            }

            router.refresh();
          } catch (error) {
            window.alert(
              error instanceof Error ? error.message : "Subscription verification failed.",
            );
          } finally {
            setState("idle");
          }
        },
        modal: {
          ondismiss: () => setState("idle"),
        },
        theme: {
          color: "#0f766e",
        },
      });

      razorpay.open();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Unable to start subscription payment.",
      );
      setState("idle");
    }
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <button type="button" onClick={handlePay} disabled={state !== "idle"} className="btn-primary">
        {state === "starting"
          ? "Opening payment..."
          : state === "verifying"
            ? "Verifying..."
            : "Pay Rs. 49/month"}
      </button>
    </>
  );
}
