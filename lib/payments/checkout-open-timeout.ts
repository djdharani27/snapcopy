export function shouldMarkCheckoutOpenTimeout(params: {
  checkoutWasOpened: boolean;
  checkoutWasDismissed: boolean;
  paymentVerificationStarted: boolean;
}) {
  return (
    params.checkoutWasOpened &&
    !params.checkoutWasDismissed &&
    !params.paymentVerificationStarted
  );
}
