export function getClientReturnVerificationPatch(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
}) {
  return {
    paymentIntentStatus: "payment_verified_client_return" as const,
    razorpayOrderId: params.razorpayOrderId,
    razorpayPaymentId: params.razorpayPaymentId,
  };
}
