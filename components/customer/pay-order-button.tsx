"use client";

import Script from "next/script";
import { useState } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

export function PayOrderButton({
  orderId,
  amount,
  customerName,
  email,
  phone,
}: {
  orderId: string;
  amount: number;
  customerName: string;
  email: string;
  phone?: string;
}) {
  const router = useRouter();
  const [paymentState, setPaymentState] = useState<"idle" | "starting" | "verifying">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const isBusy = paymentState !== "idle";

  async function getResponsePayload(response: Response) {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.toLowerCase().includes("application/json")) {
      try {
        return (await response.json()) as Record<string, unknown>;
      } catch {
        return null;
      }
    }

    try {
      const text = await response.text();
      return text ? { error: text } : null;
    } catch {
      return null;
    }
  }

  function getErrorMessage(payload: Record<string, unknown> | null, fallback: string) {
    const message = payload?.error ?? payload?.message;
    return typeof message === "string" && message.trim() ? message : fallback;
  }

  async function handlePay() {
    if (isBusy) {
      return;
    }

    let checkoutOpened = false;

    setErrorMessage("");
    setPaymentState("starting");

    try {
      const createOrderResponse = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      const createOrderPayload = await getResponsePayload(createOrderResponse);
      if (!createOrderResponse.ok) {
        throw new Error(getErrorMessage(createOrderPayload, "Unable to start payment."));
      }

      if (
        !createOrderPayload ||
        !createOrderPayload.keyId ||
        String(createOrderPayload.keyId).trim().toLowerCase() === "undefined"
      ) {
        throw new Error("Razorpay checkout is not configured correctly. Missing public key.");
      }

      if (
        typeof window !== "undefined" &&
        ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
        String(createOrderPayload.keyId).startsWith("rzp_live_")
      ) {
        throw new Error(
          "Local checkout is using a live Razorpay key. Use test keys on localhost, then switch to live keys only on your production domain.",
        );
      }

      if (!window.Razorpay) {
        throw new Error("Razorpay checkout failed to load.");
      }

      const razorpay = new window.Razorpay({
        key: createOrderPayload.keyId,
        amount: createOrderPayload.amount,
        currency: createOrderPayload.currency,
        name: "SnapCopy",
        description: "Print order payment",
        order_id: createOrderPayload.razorpayOrderId,
        prefill: {
          name: customerName,
          email,
          contact: phone || "",
        },
        handler: async (response: Record<string, string>) => {
          setErrorMessage("");
          setPaymentState("verifying");

          try {
            const verifyResponse = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });

            const verifyPayload = await getResponsePayload(verifyResponse);
            if (!verifyResponse.ok) {
              throw new Error(getErrorMessage(verifyPayload, "Payment verification failed."));
            }

            const transferError =
              typeof verifyPayload?.transferError === "string"
                ? verifyPayload.transferError
                : "";

            if (transferError) {
              window.alert(
                `Payment received. The platform team will retry the shop payout separately. ${transferError}`,
              );
            }

            router.refresh();
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Payment verification failed.";
            setErrorMessage(message);
            window.alert(message);
          } finally {
            setPaymentState("idle");
          }
        },
        modal: {
          ondismiss: () => {
            setErrorMessage("");
            setPaymentState("idle");
          },
        },
        theme: {
          color: "#0f766e",
        },
      });

      razorpay.open();
      checkoutOpened = true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to process payment.";
      setErrorMessage(message);
      window.alert(message);
    } finally {
      if (!checkoutOpened) {
        setPaymentState("idle");
      }
    }
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <button type="button" onClick={handlePay} disabled={isBusy} className="btn-primary mt-4">
        {paymentState === "starting"
          ? "Opening payment..."
          : paymentState === "verifying"
            ? "Verifying payment..."
            : `Pay now Rs. ${amount}`}
      </button>
      {errorMessage ? (
        <p className="mt-3 text-sm font-medium text-rose-700" role="alert" aria-live="polite">
          {errorMessage}
        </p>
      ) : null}
    </>
  );
}
