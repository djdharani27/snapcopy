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
  const [loading, setLoading] = useState(false);

  async function handlePay() {
    setLoading(true);

    try {
      const createOrderResponse = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      const createOrderPayload = await createOrderResponse.json();
      if (!createOrderResponse.ok) {
        throw new Error(createOrderPayload.error || "Unable to start payment.");
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

          const verifyPayload = await verifyResponse.json();
          if (!verifyResponse.ok) {
            throw new Error(verifyPayload.error || "Payment verification failed.");
          }

          if (verifyPayload.transferError) {
            window.alert(
              `Payment received. Shop payout will be retried separately. ${verifyPayload.transferError}`,
            );
          }

          router.refresh();
        },
        theme: {
          color: "#0f766e",
        },
      });

      razorpay.open();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to process payment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <button type="button" onClick={handlePay} disabled={loading} className="btn-primary mt-4">
        {loading ? "Opening payment..." : `Pay now Rs. ${amount}`}
      </button>
    </>
  );
}
