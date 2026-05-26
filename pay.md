# Payment System Documentation

This document describes the payment infrastructure currently implemented in this repository as of the present codebase state.

It covers:

1. Customer print-order payments
2. Shop payout readiness and manual admin controls
3. Razorpay order creation, verification, webhook reconciliation, and transfer tracking
4. Platform billing configuration and commission logic
5. Payment-related data stored in Firestore
6. Authorization and role boundaries
7. Implemented flows vs legacy/unwired code

## 1. Architecture Overview

The payment system is split into three layers:

1. Customer order lifecycle
   Files:
   `app/api/orders/route.ts`
   `app/api/shop-owner/orders/[orderId]/quote/route.ts`
   `app/api/orders/create/route.ts`
   `app/api/payments/verify/route.ts`
   `app/api/webhooks/razorpay/route.ts`
   `app/api/orders/[orderId]/status/route.ts`

2. Razorpay integration layer
   File:
   `lib/payments/razorpay.ts`

   This file owns:
   `createRazorpayOrder`
   `fetchRazorpayPayment`
   `fetchRazorpayPaymentTransfers`
   `createRazorpayPaymentTransfer`
   `fetchRazorpayLinkedAccount`
   `verifyRazorpaySignature`
   `verifyRazorpayWebhookSignature`
   plus linked-account / Route onboarding helpers.

3. Firestore persistence and state transitions
   File:
   `lib/firebase/firestore-admin.ts`

   This file owns nearly all payment state mutations:
   `createOrderWithFiles`
   `setOrderQuotedPricing`
   `beginOrderPaymentIntent`
   `finalizeOrderPaymentIntent`
   `failOrderPaymentIntent`
   `markOrderPaymentVerifiedClientReturn`
   `markOrderPaid`
   `markOrderPaymentFailed`
   `updateOrderTransferSnapshot`
   `updateOrderTransferState`
   `updateOrderRefundState`
   `markOrderSettlementPaid`
   `hasProcessedWebhookEvent`
   `markWebhookEventProcessed`

## 2. High-Level Payment Model

The implemented customer payment flow is:

1. Customer uploads files and creates an order.
2. The order is stored with `paymentStatus = "quote_pending"`.
3. Shop owner manually quotes the final print amount.
4. The order is updated to `paymentStatus = "ready_to_pay"`.
5. Customer opens Razorpay Checkout.
6. Backend creates a Razorpay order and stores `razorpayOrderId`.
7. Customer completes checkout in Razorpay.
8. Frontend posts the checkout return payload to `/api/payments/verify`.
9. Backend verifies signature and fetches the payment from Razorpay.
10. Backend marks only `paymentIntentStatus = "payment_verified_client_return"` on client return.
11. The order becomes truly paid only when webhook `payment.captured` or `order.paid` arrives.
12. Webhook then marks:
    `paymentStatus = "paid"`
    `status = "confirmed"`
    `paidAt = server timestamp`
13. Transfer state is then synchronized from Razorpay payment transfers.
14. Settlement to the shop is still tracked separately with `settlementStatus`.

Important distinction:

- `payment verified on client return` is not the same as `order marked paid`.
- The real source of truth for paid state is the webhook path in `app/api/webhooks/razorpay/route.ts`.

## 3. Shop Readiness Gate Before Any Customer Payment

Customers can only pay if the shop passes `canShopReceiveOnlinePayments` in:
`lib/payments/shop-readiness.ts`

That function requires:

1. `approvalStatus === "approved"`
2. `razorpayLinkedAccountId` present
3. `onlinePaymentsEnabled === true`
4. `adminVerifiedRazorpayAccount === true`

This check is used in:

- `app/api/orders/create/route.ts`
- `components/customer/customer-orders-list.tsx`
- `app/shop-owner/dashboard/page.tsx`
- `lib/payments/route-onboarding-status.ts`

Also note:

- `getAllShops()` in `lib/firebase/firestore-admin.ts` filters public/customer-visible shops to approved shops whose normalized `isActive` is truthy.
- `normalizeShop()` computes `isActive` via approval + linked-account + online-payments-enabled + admin-verified-account.
- Result: shops that are not payment-ready are generally hidden from customer shop discovery.

## 4. Order Creation Flow Before Payment

### API route

`app/api/orders/route.ts`

### Auth

Requires `requireApiRole("customer")` from `lib/auth/session.ts`.

### Main function

`POST`

### Main persistence function

`createOrderWithFiles` in `lib/firebase/firestore-admin.ts`

### What happens

1. Customer submits shop, files, print type, side type, copies, and contact info.
2. Server validates the payload and uploaded file metadata.
3. Server loads the shop via `getShopById`.
4. Server updates the customer profile via `upsertUserProfile`.
5. Server creates:
   one `orders` document
   multiple `order_files` documents
6. Initial payment-related fields are set to null/default values.

### Initial order payment fields

`createOrderWithFiles` sets:

- `paymentStatus = "quote_pending"`
- `paymentIntentStatus = "idle"`
- `printCostPaise = null`
- `platformFeePaise = null`
- `totalAmountPaise = null`
- `shopEarningPaise = null`
- `platformEarningPaise = null`
- `paymentAttemptAmountPaise = null`
- `razorpayOrderId = null`
- `razorpayPaymentId = null`
- `platformTransactionFeePaise = null`
- `estimatedFeePaise = null`
- `estimatedTaxPaise = null`
- `gatewayFeeSource = null`
- `transferableAmountPaise = null`
- `transferId = null`
- `transferStatus = "not_created"`
- `linkedAccountId = null`
- `settlementStatus = null`
- `settlementPaidAt = null`
- `refundId = null`
- `refundedAmountPaise = null`
- `paidAt = null`
- `status = "pending"`

## 5. Quote / Final Amount Flow

### API route

`app/api/shop-owner/orders/[orderId]/quote/route.ts`

### Auth

Requires `requireApiRole("shop_owner")`.

### Main functions

- `calculateQuotedOrderPricing` in `lib/payments/order-pricing.ts`
- `getBillingConfig` in `lib/platform/billing.ts`
- `calculateTransferBreakdown` in `lib/payments/transfer-calculation.ts`
- `setOrderQuotedPricing` in `lib/firebase/firestore-admin.ts`

### What happens

1. Shop owner enters the final quoted print price in rupees.
2. Server converts it to paise.
3. `calculateQuotedOrderPricing` calculates:
   `printCostPaise`
   `platformFeePaise`
   `totalAmountPaise`
   `shopEarningPaise`
   `platformEarningPaise`
4. Server loads current billing config.
5. Server precomputes the transfer breakdown with:
   `transactionFeeEnabled: false`
6. Order is updated through `setOrderQuotedPricing`.

### What `setOrderQuotedPricing` changes

- sets quoted pricing fields
- `paymentStatus = "ready_to_pay"`
- `quotedAt = server timestamp`
- `quotedByOwnerId = owner uid`
- `paymentIntentStatus = "idle"`
- clears prior Razorpay/transfer/refund/settlement state
- resets order `status = "pending"`

### Important pricing behavior

`lib/payments/order-pricing.ts` uses:
`SNAPCOPY_PLATFORM_FEE_PAISE` from `lib/utils/constants.ts`

Current value:

- `SNAPCOPY_PLATFORM_FEE_PAISE = 0`

So the customer-facing platform fee on print orders is currently zero.

## 6. Razorpay Order Creation Flow

### API route

`app/api/orders/create/route.ts`

### Auth

Requires `requireApiRole("customer")`.

### Main functions involved

- `getRazorpayKeyId`
- `createRazorpayOrder`
- `calculateTransferBreakdown`
- `getBillingConfig`
- `beginOrderPaymentIntent`
- `finalizeOrderPaymentIntent`
- `failOrderPaymentIntent`

### Step-by-step flow

1. Customer clicks pay in `components/customer/pay-order-button.tsx`.
2. Frontend calls `POST /api/orders/create` with `orderId`.
3. Server validates:
   order exists
   order belongs to logged-in customer
   order is not already paid
   order has trusted pricing
   order payment status is one of:
   `ready_to_pay`
   `payment_failed`
   `unpaid`
4. Server loads the shop and requires `canShopReceiveOnlinePayments(shop)`.
5. Server computes:
   `shouldForceFreshOrder = NODE_ENV !== "production" || keyId.startsWith("rzp_test_")`
6. Server computes:
   `shouldAttachOrderTransfers = !keyId.startsWith("rzp_test_")`
7. Server calls `beginOrderPaymentIntent`.
8. `beginOrderPaymentIntent` transaction prevents duplicate/in-flight order creation.
9. If reusable, existing `razorpayOrderId` may be returned.
10. Otherwise server calls `createRazorpayOrder` in `lib/payments/razorpay.ts`.
11. Server stores the resulting `razorpayOrderId` through `finalizeOrderPaymentIntent`.
12. Backend returns:
    `razorpayOrderId`
    `amount`
    `currency`
    `keyId`

### Concurrency / duplicate protection

`beginOrderPaymentIntent` in `lib/firebase/firestore-admin.ts`:

- returns `action = "paid"` if already paid
- returns `action = "reuse"` if an existing usable Razorpay order already exists
- returns `action = "creating"` if another request already claimed creation
- otherwise sets:
  `paymentIntentStatus = "creating"`
  and clears stale payment/transfer/refund fields

If later API work fails, `failOrderPaymentIntent(orderId)` resets only:

- `paymentIntentStatus = "idle"`

### Order notes sent to Razorpay

`createRazorpayOrder` attaches notes:

- `orderId`
- `shopId`
- `customerId`
- `pageCount`
- `copies`

### Route transfer attachment behavior

When `shouldAttachOrderTransfers` is true, `/v1/orders` is called with a `transfers` array:

- `account = shop.razorpayLinkedAccountId`
- `amount = order.transferableAmountPaise` or recalculated fallback
- notes:
  `orderId`
  `shopId`

This happens only when the key does not start with `rzp_test_`.

Important:

- In test mode, transfers are intentionally not attached to the order.
- There is no later implemented code path that creates the transfer manually for the same order.
- The helper `createRazorpayPaymentTransfer` exists in `lib/payments/razorpay.ts` but is not used anywhere in active routes.

## 7. Frontend Checkout Flow

### File

`components/customer/pay-order-button.tsx`

### What it does

1. Loads `https://checkout.razorpay.com/v1/checkout.js`.
2. Calls `/api/orders/create`.
3. Validates returned `keyId`, `razorpayOrderId`, `currency`, and `amount`.
4. Blocks live checkout on localhost unless:
   `NEXT_PUBLIC_ALLOW_LIVE_RAZORPAY_ON_LOCALHOST === "true"`
5. Opens Razorpay Checkout.
6. On `handler`, posts result to `/api/payments/verify`.
7. On modal dismiss, resets local UI state.
8. If checkout never opens within 10s, shows a timeout error using:
   `shouldMarkCheckoutOpenTimeout` from `lib/payments/checkout-open-timeout.ts`

### Important frontend observation

The component looks for `verifyPayload.transferError`, but the current `/api/payments/verify` route does not return `transferError`.

## 8. Payment Verification Flow

### API route

`app/api/payments/verify/route.ts`

### Auth

Requires `requireApiRole("customer")`.

### Main functions

- `verifyRazorpaySignature`
- `fetchRazorpayPayment`
- `markOrderPaymentVerifiedClientReturn`

### Step-by-step flow

1. Frontend sends:
   `orderId`
   `razorpayOrderId`
   `razorpayPaymentId`
   `razorpaySignature`
2. Server loads the order and ensures it belongs to the customer.
3. If order is already `paid`, server returns early.
4. Server checks stored `order.razorpayOrderId === submitted razorpayOrderId`.
5. Server validates Razorpay signature using:
   `HMAC_SHA256(orderId|paymentId, keySecret)`
6. Server fetches payment from Razorpay using `fetchRazorpayPayment`.
7. Server validates:
   `payment.order_id === razorpayOrderId`
   `payment.amount === order.totalAmountPaise`
   `payment.captured === true`
   `payment.status === "captured"`
8. Server writes `markOrderPaymentVerifiedClientReturn`.

### What `markOrderPaymentVerifiedClientReturn` writes

Via `getClientReturnVerificationPatch` in `lib/payments/client-payment-verification.ts`:

- `paymentIntentStatus = "payment_verified_client_return"`
- `razorpayOrderId = submitted order id`
- `razorpayPaymentId = submitted payment id`

### Important behavior

This route does not mark:

- `paymentStatus = "paid"`
- `status = "confirmed"`
- `paidAt`

That only happens in the webhook route.

## 9. Razorpay Webhook Flow

### API route

`app/api/webhooks/razorpay/route.ts`

### Signature verification

Uses:
`verifyRazorpayWebhookSignature({ rawBody, signature })`

The signature comes from:

- `x-razorpay-signature`

The event id comes from:

- `x-razorpay-event-id`

### Idempotency storage

Collection:
`razorpay_webhook_events`

Functions:

- `hasProcessedWebhookEvent`
- `markWebhookEventProcessed`
- `isDuplicateWebhookEventProcessed`

### Implemented event handling

#### `payment.captured`

1. Find order by `razorpayPaymentId`
2. Fallback to order lookup by `razorpayOrderId`
3. If order exists and not already paid:
   call `markOrderPaid`
4. Call `syncOrderTransferState(order.id)`

#### `payment.failed`

1. Find order by payment id or order id
2. If order exists and not already paid:
   call `markOrderPaymentFailed`

#### `order.paid`

1. Find order by `razorpayOrderId`
2. If order exists and not already paid:
   call `markOrderPaid`
3. Call `syncOrderTransferState(order.id)`

#### `transfer.processed`
#### `transfer.failed`
#### `transfer.reversed`

1. Find order by `transferId`
2. Fallback: derive the source order id via `getTransferWebhookOrderId(transferEntity.source)`
3. If order is found:
   call `updateOrderTransferState`
4. Transfer failure reason is built from Razorpay error description + reason.

#### `refund.created`
#### `refund.processed`
#### `refund.failed`

1. Find order by `refund.payment_id`
2. Update payment state with `updateOrderRefundState`

Mapping:

- `refund.created -> paymentStatus = "refund_pending"`
- `refund.processed -> paymentStatus = "refunded"`
- `refund.failed -> paymentStatus = "refund_failed"`

#### `product.route.*`

Handled events:

- `product.route.activated`
- `product.route.under_review`
- `product.route.needs_clarification`
- `product.route.suspended`

These update shop payout/onboarding state using:

- `getShopByLinkedAccountId`
- `mapRouteRequirements`
- `buildRouteWebhookStatusUpdate`
- `updateShopRazorpayStatus`

### What `markOrderPaid` changes

`lib/firebase/firestore-admin.ts`

- `paymentStatus = "paid"`
- `paymentIntentStatus = "ready"`
- `razorpayOrderId`
- `razorpayPaymentId`
- `status = "confirmed"`
- `settlementStatus = null`
- `settlementPaidAt = null`
- `paidAt = server timestamp`
- clears refund fields

### Webhook idempotency limitations

The webhook route checks:

1. `hasProcessedWebhookEvent(eventId)`
2. processes the event
3. then calls `markWebhookEventProcessed`

This is idempotent against normal repeated deliveries, but it is not a single transaction across check-and-write. Two concurrent deliveries of the same event could still race before the processed marker is written.

## 10. Transfer / Linked Account / Route Flow

There are two separate concepts in the code:

1. Active customer order payout routing
2. Shop linked-account onboarding data

### A. Active transfer tracking for paid customer orders

Primary files:

- `lib/payments/transfers.ts`
- `lib/payments/transfer-calculation.ts`
- `app/api/transfers/create/route.ts`
- `app/api/admin/orders/[orderId]/retry-transfer/route.ts`

### `syncOrderTransferState(orderId)`

This function:

1. requires the order to already be `paymentStatus = "paid"`
2. loads the shop and linked account id
3. fetches Razorpay payment
4. fetches payment transfers via `/v1/payments/{paymentId}/transfers`
5. finds the transfer whose `recipient === shop.razorpayLinkedAccountId`
6. recalculates transfer breakdown
7. stores transfer snapshot fields
8. writes transfer status

If no transfer is found:

- it writes `transferStatus = "processing"`
- it does not create a transfer

### Important implementation fact

Although the project has:

- `createRazorpayPaymentTransfer` in `lib/payments/razorpay.ts`
- `claimOrderTransferCreation` in `lib/firebase/firestore-admin.ts`

neither is used in the active flow.

So:

- there is no active server route that creates a missing transfer after payment capture
- retry endpoints only resync state from Razorpay
- they do not create a new transfer

### B. Linked account / Route onboarding data

Active manual admin onboarding uses:

- `app/api/shops/route.ts`
- `app/api/admin/shops/[shopId]/route.ts`
- `lib/payments/shop-readiness.ts`
- `components/shop-owner/shop-setup-form.tsx`
- `components/admin/admin-panel.tsx`

Shop owners submit:

- `settlementEmail`
- `bankAccountHolderName`
- `bankIfsc`
- `bankAccountNumber`
- `ownerPan`
- `acceptRouteTerms`

These are stored in Firestore on the `shops` document, primarily as:

- `settlementEmail`
- `bankAccountHolderName`
- `bankIfsc`
- `bankAccountLast4`
- `pendingBankAccountNumber`
- `pendingOwnerPan`
- `pendingRouteTermsAccepted`

Admins later manually save:

- `razorpayLinkedAccountId`
- `razorpayLinkedAccountStatus`
- `onlinePaymentsEnabled`
- `adminVerifiedRazorpayAccount`
- `paymentOnboardingNote`

### Legacy automated Route onboarding code

There is substantial Route onboarding logic in:

- `lib/shops/route-onboarding.ts`

Exported functions:

- `approveShopAndRunRouteOnboarding`
- `syncShopRazorpayStatus`

This code can:

- create linked accounts
- create stakeholders
- request Route product configuration
- patch settlement configuration
- sync product requirements

However, the active admin/customer routes currently do not call this file.

Also both sync routes now explicitly return `410`:

- `app/api/shops/sync-status/route.ts`
- `app/api/admin/shops/[shopId]/sync-status/route.ts`

So automated Route onboarding exists in the repo but is effectively legacy/unwired in the active application flow.

## 11. Shop Owner Payout Handling

Payout handling is currently a hybrid of automated tracking and manual settlement confirmation.

### What is automated

- Razorpay order creation can attach order-level `transfers` in non-test mode.
- Webhooks reconcile transfer status into the order document.
- `syncOrderTransferState` updates transfer metadata from Razorpay.

### What is manual

Admins manually review settlement obligations in the admin panel.

Files:

- `app/admin/page.tsx`
- `components/admin/admin-panel.tsx`
- `app/api/admin/orders/[orderId]/settlement/route.ts`

Admin-facing settlement flow:

1. Admin page loads `getOrdersNeedingSettlementAttention()`.
2. This returns all paid orders whose `settlementStatus !== "paid"`.
3. Admin can click "Mark settlement paid".
4. Route `POST /api/admin/orders/[orderId]/settlement` calls `markOrderSettlementPaid`.
5. Firestore writes:
   `settlementStatus = "paid"`
   `settlementPaidAt = server timestamp`

Important:

- `settlementStatus` is not proof of Razorpay transfer completion.
- It is an internal platform bookkeeping flag for whether the shop has been settled from the platform side.

## 12. Platform Fees / Commission Calculation

There are three separate fee concepts in the codebase.

### A. Customer-facing platform fee on print orders

Source:
`lib/payments/order-pricing.ts`

Uses:
`SNAPCOPY_PLATFORM_FEE_PAISE` from `lib/utils/constants.ts`

Current value:

- `0`

So customer print orders currently add no platform fee.

### B. Transfer-side platform transaction fee config

Source:
`lib/platform/billing.ts`
`lib/payments/transfer-calculation.ts`

Config fields:

- `transactionFeePaise`
- `transactionFeeEnabled`

But in the active customer order flow, transfer calculations are called with:

- `transactionFeeEnabled: false`

This happens in:

- `app/api/shop-owner/orders/[orderId]/quote/route.ts`
- `app/api/orders/create/route.ts`
- `lib/payments/transfers.ts`

Result:

- the configured flat platform commission is currently disabled in actual transfer calculations
- `platformTransactionFeePaise` becomes `0` in practice for customer print orders

### C. Estimated Razorpay fee and GST

Used in:
`calculateTransferBreakdown`

Calculation:

- gateway fee = either actual payment fee from Razorpay, or estimated percent fallback
- tax = either actual tax from Razorpay, or estimated GST percent fallback
- transferable amount =
  `shopAmountPaise - platformTransactionFeePaise - estimatedFeePaise - estimatedTaxPaise`

### Net conclusion

Current customer-order economics in active code:

- print amount goes to `shopEarningPaise`
- customer platform fee is `0`
- transfer-side platform commission is effectively disabled
- gateway fee + tax are deducted from shop transferable amount

## 13. Environment Variables Used

### Razorpay credentials

Defined/used in:
`lib/payments/razorpay.ts`

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `RAZORPAY_WEBHOOK_SECRET`
- `RAZORPAY_TEST_KEY_ID`
- `RAZORPAY_TEST_KEY_SECRET`
- `NEXT_PUBLIC_RAZORPAY_TEST_KEY_ID`
- `RAZORPAY_TEST_WEBHOOK_SECRET`

Behavior:

- non-production prefers test credentials if present
- `getRazorpayKeyId()` enforces that public and server key ids point to the same Razorpay account

### Route onboarding env vars

- `RAZORPAY_ROUTE_BUSINESS_CATEGORY`
- `RAZORPAY_ROUTE_BUSINESS_SUBCATEGORY`

Used by linked-account creation helpers in `lib/payments/razorpay.ts`.

### Billing fallback env vars

- `PLATFORM_TRANSACTION_FEE_PAISE`
- `PLATFORM_SHOP_CREATION_FEE_PAISE`
- `RAZORPAY_ESTIMATED_FEE_PERCENT`
- `RAZORPAY_ESTIMATED_GST_PERCENT`

Used in:

- `lib/platform/billing.ts`
- `lib/payments/transfer-calculation.ts`

### Client safety env var

- `NEXT_PUBLIC_ALLOW_LIVE_RAZORPAY_ON_LOCALHOST`

Used only in:
`components/customer/pay-order-button.tsx`

### Admin authorization env var

- `ADMIN_EMAILS`

Used in:
`lib/auth/admin.ts`

## 14. API Routes Involved

### Customer order payment path

- `POST /api/orders`
  create order + file records

- `PATCH /api/shop-owner/orders/[orderId]/quote`
  shop owner sets final payable amount

- `POST /api/orders/create`
  create or reuse Razorpay order for checkout

- `POST /api/payments/verify`
  verify Razorpay client return payload

- `POST /api/webhooks/razorpay`
  authoritative payment/transfer/refund reconciliation

- `PATCH /api/orders/[orderId]/status`
  shop owner can change fulfilment status only after payment is paid

### Transfer / settlement admin path

- `POST /api/transfers/create`
  admin-only sync endpoint, despite its name

- `POST /api/admin/orders/[orderId]/retry-transfer`
  admin-only resync endpoint, does not create a new transfer

- `POST /api/admin/orders/[orderId]/settlement`
  manually mark settlement paid

### Shop onboarding / payout readiness path

- `GET /api/shops`
  customer-visible ready shops only

- `POST /api/shops`
  shop owner submits shop + payout details for approval

- `PATCH /api/shops`
  shop owner resubmits payout details / shop details

- `POST /api/admin/shops`
  admin creates a shop record directly

- `PATCH /api/admin/shops/[shopId]`
  approve/reject shop, save manual linked-account details, enable payments

- `GET /api/admin/shops/[shopId]/sensitive-payout-details`
  reveal full stored bank/PAN details to admin

- `POST /api/admin/shops/[shopId]/sync-status`
  disabled legacy endpoint, returns `410`

- `POST /api/shops/sync-status`
  disabled legacy endpoint, returns `410`

### Billing config path

- `GET /api/admin/billing`
- `PATCH /api/admin/billing`
- `POST /api/admin/billing`

## 15. Database Collections / Documents / Fields

### `orders`

Main payment/order state document.

Important fields:

- `id`
- `trackingCode`
- `customerId`
- `shopId`
- `printCostPaise`
- `platformFeePaise`
- `totalAmountPaise`
- `shopEarningPaise`
- `platformEarningPaise`
- `paymentStatus`
- `paymentIntentStatus`
- `paymentAttemptAmountPaise`
- `razorpayOrderId`
- `razorpayPaymentId`
- `platformCommissionPaise` (legacy compatibility field)
- `platformTransactionFeePaise`
- `estimatedFeePaise`
- `estimatedTaxPaise`
- `gatewayFeeSource`
- `transferableAmountPaise`
- `transferId`
- `transferStatus`
- `transferFailureReason`
- `transferUpdatedAt`
- `linkedAccountId`
- `settlementStatus`
- `settlementPaidAt`
- `refundId`
- `refundedAmountPaise`
- `paidAt`
- `status`

### `order_files`

Stores uploaded file metadata per order.

Important fields:

- `id`
- `orderId`
- `originalFileName`
- `s3Key`
- `s3Url`
- `mimeType`
- `size`
- `pageCount`

### `shops`

Stores both shop state and payout readiness data.

Important payout/payment fields:

- `approvalStatus`
- `settlementEmail`
- `razorpayLinkedAccountId`
- `razorpayLinkedAccountStatus`
- `razorpayStakeholderId`
- `razorpayProductId`
- `razorpayProductStatus`
- `razorpayProductResolutionUrl`
- `razorpayLinkedAccountStatusReason`
- `razorpayLinkedAccountStatusDescription`
- `razorpayProductRequirements`
- `razorpayOwnerPanStatus`
- `razorpayBankVerificationStatus`
- `razorpayRouteTermsAccepted`
- `paymentBlockedReason`
- `razorpayStatusLastSyncedAt`
- `bankAccountHolderName`
- `bankIfsc`
- `bankAccountLast4`
- `pendingBankAccountNumber`
- `pendingOwnerPan`
- `pendingRouteTermsAccepted`
- `onlinePaymentsEnabled`
- `adminVerifiedRazorpayAccount`
- `paymentOnboardingNote`
- `isActive`

### `platform_settings/billing`

Managed by `lib/platform/billing.ts`

Fields:

- `shopCreationFeePaise`
- `transactionFeePaise`
- `estimatedRazorpayFeePercent`
- `estimatedGstPercent`
- `shopCreationFeeEnabled`
- `transactionFeeEnabled`
- `updatedAt`
- `updatedBy`

### `platform_settings_audit`

Audit log for billing changes.

### `razorpay_webhook_events`

Webhook idempotency/reconciliation log.

Fields:

- `eventId`
- `razorpayEventId`
- `eventName`
- `eventType`
- `payloadJson`
- `createdAt`
- `processedAt`

### `shops/{shopId}/order_counters/{date}`

Used by `createOrderWithFiles` to generate daily tracking codes.

### `users`

Needed for role/auth checks:

- `uid`
- `email`
- `role`
- `phone`

### `shop_subscription_payments`

Collection exists in code, but the active API routes for it are missing.

Fields:

- `shopId`
- `amountPaise`
- `razorpayOrderId`
- `razorpayPaymentId`
- `status`
- `paidAt`

## 16. Payment Status Changes

### `paymentStatus` state machine

Implemented values in `types/index.ts`:

- `quote_pending`
- `ready_to_pay`
- `unpaid`
- `payment_failed`
- `paid`
- `refund_pending`
- `refunded`
- `refund_failed`

### Actual transitions in code

1. Order creation:
   `quote_pending`

2. Shop owner saves quote:
   `ready_to_pay`

3. Payment order create flow may preserve:
   `ready_to_pay`
   or `payment_failed`
   or `unpaid`

4. Webhook `payment.failed`:
   `payment_failed`

5. Webhook `payment.captured` or `order.paid`:
   `paid`

6. Webhook `refund.created`:
   `refund_pending`

7. Webhook `refund.processed`:
   `refunded`

8. Webhook `refund.failed`:
   `refund_failed`

### `paymentIntentStatus` state machine

Values:

- `idle`
- `creating`
- `ready`
- `payment_verified_client_return`

Used to guard order-creation concurrency and client-return acknowledgement.

## 17. Order Status Dependence on Payment Status

Order fulfilment status is separate from payment status.

### `status` values

- `pending`
- `confirmed`
- `in_progress`
- `ready_for_pickup`
- `completed`

### How it depends on payment

1. On order creation:
   `status = "pending"`

2. On quote save:
   `status = "pending"`

3. On paid webhook:
   `markOrderPaid` sets:
   `status = "confirmed"`

4. Shop owner can only update fulfilment status through:
   `PATCH /api/orders/[orderId]/status`
   if `order.paymentStatus === "paid"`

So:

- unpaid or merely client-verified orders cannot move into production fulfilment
- paid webhook is the unlock point

## 18. Retry / Manual Transfer Behavior

### What exists

- `POST /api/transfers/create`
- `POST /api/admin/orders/[orderId]/retry-transfer`
- `syncOrderTransferState(orderId)`
- `getOrdersNeedingTransferAttention()`
- admin panel transfer-attention UI

### What retry actually does

Both routes only call:

- `syncOrderTransferState(orderId)`

That function reads current Razorpay transfer state and writes Firestore state.

It does not:

- call `createRazorpayPaymentTransfer`
- create a fresh Route transfer

### Practical implication

If a payment exists but Razorpay has no transfer for that payment:

- the order becomes `transferStatus = "processing"`
- retry still just resyncs
- there is no implemented in-app path to create the transfer afterwards

## 19. Authorization Model

### Session/auth foundation

File:
`lib/auth/session.ts`

Auth is based on Firebase ID token or session cookie:

- cookie name: `firebase-session`

Core auth functions:

- `requireApiAuth`
- `requireApiRole`
- `requireRole`

### Admin auth

File:
`lib/auth/admin.ts`

Admin access is granted if either:

1. user profile role is `admin`
2. user email is in `ADMIN_EMAILS`

Core admin function:

- `requireApiAdmin`

### Route-level role boundaries

Customer-only:

- `/api/orders`
- `/api/orders/create`
- `/api/payments/verify`

Shop-owner-only:

- `/api/shop-owner/orders/[orderId]/quote`
- `/api/shop-owner/settings`
- `/api/orders/[orderId]/status`
- `/api/shops/sync-status` (disabled but protected)

Admin-only:

- `/api/transfers/create`
- `/api/admin/orders/[orderId]/retry-transfer`
- `/api/admin/orders/[orderId]/settlement`
- `/api/admin/billing`
- `/api/admin/shops`
- `/api/admin/shops/[shopId]`
- `/api/admin/shops/[shopId]/sync-status`
- `/api/admin/shops/[shopId]/sensitive-payout-details`

## 20. Role-Based Access by Actor

### Customer

Can:

- create orders
- view own orders
- open checkout
- submit client-side payment verification

Cannot:

- quote order prices
- move fulfilment status
- access admin payout tools

### Shop owner

Can:

- submit or resubmit shop payout details
- set final order amount
- change order fulfilment status after payment is paid
- view transfer status on their orders

Cannot:

- enable their own online payments
- verify their own Razorpay linked account
- mark settlements paid
- reveal sensitive payout details from admin endpoint

### Admin

Can:

- approve/reject shops
- save or update linked account id
- enable online payments
- mark linked account verified
- view sensitive payout details
- inspect failed/pending transfer cases
- mark manual settlements paid
- change billing configuration

## 21. Files and Functions Responsible for Each Step

### Customer order creation

- `app/api/orders/route.ts`
- `lib/firebase/firestore-admin.ts -> createOrderWithFiles`

### Quote/final price

- `app/api/shop-owner/orders/[orderId]/quote/route.ts`
- `lib/payments/order-pricing.ts -> calculateQuotedOrderPricing`
- `lib/payments/transfer-calculation.ts -> calculateTransferBreakdown`
- `lib/firebase/firestore-admin.ts -> setOrderQuotedPricing`

### Checkout order creation

- `components/customer/pay-order-button.tsx -> handlePay`
- `app/api/orders/create/route.ts -> POST`
- `lib/firebase/firestore-admin.ts -> beginOrderPaymentIntent`
- `lib/payments/razorpay.ts -> createRazorpayOrder`
- `lib/firebase/firestore-admin.ts -> finalizeOrderPaymentIntent`

### Client return verification

- `components/customer/pay-order-button.tsx -> Razorpay handler`
- `app/api/payments/verify/route.ts -> POST`
- `lib/payments/razorpay.ts -> verifyRazorpaySignature`
- `lib/payments/razorpay.ts -> fetchRazorpayPayment`
- `lib/firebase/firestore-admin.ts -> markOrderPaymentVerifiedClientReturn`

### Authoritative payment success/failure

- `app/api/webhooks/razorpay/route.ts -> POST`
- `lib/firebase/firestore-admin.ts -> markOrderPaid`
- `lib/firebase/firestore-admin.ts -> markOrderPaymentFailed`

### Transfer reconciliation

- `app/api/webhooks/razorpay/route.ts`
- `lib/payments/transfers.ts -> syncOrderTransferState`
- `lib/firebase/firestore-admin.ts -> updateOrderTransferSnapshot`
- `lib/firebase/firestore-admin.ts -> updateOrderTransferState`

### Refund reconciliation

- `app/api/webhooks/razorpay/route.ts`
- `lib/firebase/firestore-admin.ts -> updateOrderRefundState`

### Manual settlement bookkeeping

- `app/api/admin/orders/[orderId]/settlement/route.ts`
- `lib/firebase/firestore-admin.ts -> markOrderSettlementPaid`

### Payment readiness / shop gating

- `lib/payments/shop-readiness.ts -> canShopReceiveOnlinePayments`
- `lib/payments/shop-readiness.ts -> getShopPaymentBlockedReason`
- `app/api/admin/shops/[shopId]/route.ts`
- `app/api/shops/route.ts`

### Manual linked-account admin save

- `app/api/admin/shops/[shopId]/route.ts`
- `lib/payments/razorpay.ts -> fetchRazorpayLinkedAccount`
- `lib/firebase/firestore-admin.ts -> updateShopRouteDetails`
- `lib/firebase/firestore-admin.ts -> updateShopApproval`

### Webhook idempotency

- `lib/firebase/firestore-admin.ts -> hasProcessedWebhookEvent`
- `lib/firebase/firestore-admin.ts -> markWebhookEventProcessed`
- `lib/payments/route-webhook-state.ts -> isDuplicateWebhookEventProcessed`

## 22. Edge Cases and Error Handling

### Guarded cases in order creation

`app/api/orders/create/route.ts` rejects:

- missing order id
- wrong customer
- `paymentStatus = "quote_pending"`
- missing trusted pricing
- already paid order
- shop not found
- shop not payment-ready
- missing linked account

### Guarded cases in payment verification

`app/api/payments/verify/route.ts` rejects:

- missing payload pieces
- wrong customer
- order mismatch
- invalid signature
- payment/order mismatch
- amount mismatch
- uncaptured payment

### Guarded cases in shop quote flow

`app/api/shop-owner/orders/[orderId]/quote/route.ts` rejects:

- non-numeric amount
- amount <= 0
- wrong shop owner
- paid order repricing
- refunded/refund-pending/refund-failed order repricing

### Guarded cases in fulfilment status flow

`app/api/orders/[orderId]/status/route.ts` rejects:

- invalid status
- reverting to `pending`
- wrong shop owner
- any order not yet `paymentStatus = "paid"`

### Guarded cases in admin manual linked-account save

`app/api/admin/shops/[shopId]/route.ts` rejects:

- inaccessible linked account id
- enabling payments without saving linked account id
- enabling payments without admin verification checkbox

### Transfer attention logic

Orders are flagged by `isTransferAttentionOrder` in `lib/payments/route-webhook-state.ts` when:

- `transferStatus = failed`
- `transferStatus = processing`
- `transferStatus = pending`
- `paymentStatus = refund_pending`
- `paymentStatus = refund_failed`
- `paymentStatus = refunded` and transfer is not `reversed`

## 23. Security-Sensitive Logic

### Server-only secrets

Should remain server-only:

- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `RAZORPAY_TEST_KEY_SECRET`
- `RAZORPAY_TEST_WEBHOOK_SECRET`
- Firebase admin credentials

These are used only from server-side files such as:

- `lib/payments/razorpay.ts`
- `lib/firebase/admin.ts`

### Signature verification

Customer return signature:

- `verifyRazorpaySignature`

Webhook signature:

- `verifyRazorpayWebhookSignature`

Both use HMAC SHA-256.

### Sensitive Firestore data

Shop onboarding stores sensitive values in Firestore:

- `pendingBankAccountNumber`
- `pendingOwnerPan`

These can be revealed via the admin-only endpoint:

- `GET /api/admin/shops/[shopId]/sensitive-payout-details`

### Firestore rules

File:
`firestore.rules`

Client-side Firestore rules exist, but most payment state mutations use the Firebase Admin SDK in server routes via `getAdminDb()`, which bypasses Firestore security rules. The true protection for payment mutations is therefore server-route authorization, not client rules.

### Notable security observations

1. Signature comparison in `lib/payments/razorpay.ts` uses direct string equality, not a timing-safe compare.
2. Webhook idempotency is check-then-write, not fully transactional.
3. Sensitive bank account/PAN values are stored in Firestore until approval cleanup.

## 24. Implemented vs Legacy / Unwired Payment Code

### Implemented and active

- customer order checkout
- Razorpay order creation
- client-side signature verification
- webhook-based payment finalization
- transfer-state reconciliation from Razorpay
- manual admin settlement tracking
- manual linked-account save and payment enablement

### Present in repo but not active in request flow

- `lib/shops/route-onboarding.ts`
  automated Route onboarding/orchestration

- `createRazorpayPaymentTransfer`
  helper exists but not used

- `claimOrderTransferCreation`
  helper exists but not used

- `components/shop-owner/pay-subscription-button.tsx`
  UI exists, but matching API routes `/api/shop-subscriptions/create` and `/api/shop-subscriptions/verify` are not present in this repo snapshot

- `shop_subscription_payments` collection helpers in `lib/firebase/firestore-admin.ts`
  exist, but active routes invoking them are absent

## 25. Re-Implementation Notes for Another Project

If another agent needs to rebuild this payment system elsewhere, the actual current behavior to replicate is:

1. Create customer order first with no amount and `paymentStatus = "quote_pending"`.
2. Let shop owner set a final amount later.
3. Move order to `ready_to_pay`.
4. On pay click, create a Razorpay order server-side.
5. Store `razorpayOrderId` on the order.
6. Verify client return signature and payment details, but do not trust that alone as final paid state.
7. Finalize paid status only on webhook `payment.captured` or `order.paid`.
8. Sync transfer state from Razorpay after payment success.
9. Keep transfer reconciliation separate from internal settlement bookkeeping.
10. Gate all checkout initiation on shop approval + linked account present + admin verification + online payments enabled.
11. Treat webhooks as authoritative and idempotent.
12. Keep admin-only controls for manual payout attention and settlement confirmation.

## 26. Most Important Practical Findings

1. Customer order payment success is webhook-driven, not client-return-driven.
2. Shops must be manually payment-enabled by admin before checkout is allowed.
3. Customer platform fee is currently zero.
4. Configured platform transaction fee exists but is disabled in active transfer calculations.
5. Retry transfer endpoints only resync state; they do not create a new transfer.
6. Test-mode checkout intentionally avoids attached Razorpay order transfers.
7. Automated Route onboarding code exists but is currently not wired into the active routes.
8. Sensitive payout data is stored in Firestore and exposed only through an admin endpoint.
