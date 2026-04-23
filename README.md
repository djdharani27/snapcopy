# SnapCopy MVP

Lean Xerox / print-shop marketplace MVP built with Next.js App Router, Firebase Auth, Firestore, Amazon S3, and Tailwind CSS.

## Stack

- Next.js 16 App Router
- TypeScript
- Firebase Authentication with Google sign-in
- Firestore
- Firebase Admin for secure server-side auth verification
- Amazon S3 for file storage
- Tailwind CSS v4

## What this MVP includes

- Customer sign-in with Google
- First-login role selection: `customer` or `shop_owner`
- Shop owner can create exactly one shop
- Customer dashboard with shop search
- Customer file upload flow to secure Next.js API route
- Server-side S3 upload using AWS SDK
- Firestore storage for users, shops, orders, and order files metadata
- Shop owner dashboard with incoming orders
- Download links generated as short-lived signed S3 URLs
- Order status updates: `pending`, `completed`
- Razorpay Checkout payment collection with server-side Route transfer creation after payment verification

## Architecture decisions

- Firebase Auth runs on the client for Google sign-in.
- After sign-in, the client sends the Firebase ID token to `/api/session`.
- The server stores that token in an `httpOnly` cookie named `firebase-session`.
- Server pages and API routes verify the cookie with Firebase Admin before reading or mutating protected data.
- Firestore stores metadata only. Files are uploaded server-side to S3 so AWS secrets never reach the browser.
- Firestore is accessed on the server for dashboard pages, which keeps role checks centralized and simple for MVP scope.

## Required environment variables

Copy `.env.local.example` to `.env.local` and replace every placeholder.

### Firebase client

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### Firebase Admin

These two extra variables are required for secure server verification:

- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Use a Firebase service account from your project settings. Keep the private key wrapped in quotes and preserve `\n`.

### AWS S3

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `AWS_S3_BUCKET_NAME`
- `AWS_S3_ENDPOINT` (optional, only if your bucket requires an explicit endpoint)

### Razorpay

- `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `RAZORPAY_ROUTE_BUSINESS_CATEGORY`
- `RAZORPAY_ROUTE_BUSINESS_SUBCATEGORY`
- `PLATFORM_TRANSACTION_FEE_PAISE`
- `PLATFORM_SHOP_CREATION_FEE_PAISE`
- `RAZORPAY_ESTIMATED_FEE_PERCENT`
- `RAZORPAY_ESTIMATED_GST_PERCENT`

Each shop owner needs a Razorpay Route Linked Account. The app creates one during shop setup using the shop details entered in the onboarding form. Platform billing values are stored in Firestore under `platform_settings/billing`, and these env vars only act as fallbacks.

For Route onboarding, Razorpay requires `profile.category` and `profile.subcategory` to be a valid documented pair. Set `RAZORPAY_ROUTE_BUSINESS_CATEGORY` and `RAZORPAY_ROUTE_BUSINESS_SUBCATEGORY` to the exact values approved for your business in the Razorpay Route/KYC docs.

For live cutover, point `NEXT_PUBLIC_RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` at your live credentials, and set `RAZORPAY_WEBHOOK_SECRET` to the webhook secret from the same live Razorpay account. If you keep both test and live credentials in `.env.local`, Next.js supports `$VARIABLE` expansion so the active values can reference the live ones.

## Local setup

1. Create a Firebase project.
2. Enable Google sign-in in Firebase Authentication.
3. Create a Firestore database.
4. Create an AWS S3 bucket.
5. Copy `.env.local.example` to `.env.local`.
6. Fill in Firebase client config, Firebase Admin service-account values, and AWS credentials.
7. Run `npm install`.
8. Run `npm run dev`.
9. Open `http://localhost:3000`.

## Firestore schema guidance

### `users`

- `uid`: string
- `name`: string
- `email`: string
- `role`: `customer | shop_owner`
- `createdAt`: timestamp

### `shops`

- `id`: string
- `ownerId`: string
- `shopName`: string
- `address`: string
- `city`: string
- `state`: string
- `postalCode`: string
- `phone`: string
- `description`: string
- `razorpayLinkedAccountId`: string
- `razorpayLinkedAccountStatus`: string
- `razorpayStakeholderId`: string
- `razorpayProductId`: string
- `razorpayProductStatus`: string
- `bankAccountHolderName`: string
- `bankIfsc`: string
- `bankAccountLast4`: string
- `createdAt`: timestamp

### `orders`

- `id`: string
- `customerId`: string
- `shopId`: string
- `customerName`: string
- `customerPhone`: string
- `notes`: string
- `printType`: `color | black_white`
- `sideType`: `single_side | double_side`
- `copies`: number
- `status`: `pending | completed`
- `finalAmount`: number or null
- `paymentStatus`: `unpaid | paid`
- `razorpayOrderId`: string or null
- `razorpayPaymentId`: string or null
- `platformCommissionPaise`: number or null, legacy field kept only for backward compatibility
- `platformTransactionFeePaise`: number or null
- `estimatedFeePaise`: number or null
- `estimatedTaxPaise`: number or null
- `transferableAmountPaise`: number or null
- `transferId`: string or null
- `transferStatus`: `not_created | pending | processing | success | failed`
- `linkedAccountId`: string or null
- `paidAt`: timestamp or null
- `createdAt`: timestamp

### `order_files`

- `id`: string
- `orderId`: string
- `originalFileName`: string
- `s3Key`: string
- `s3Url`: string
- `mimeType`: string
- `size`: number
- `createdAt`: timestamp

## Firestore rules

Use [firestore.rules](/C:/Users/gearz/OneDrive/Documents/New----CODE/AI/vibe__coding/snapcopy/firestore.rules) as the baseline. The rules allow:

- users to read and edit only their own profile
- signed-in users to read shops
- customers to create their own orders
- shop owners to read and update orders only for their own shop
- customers and owning shop owners to read related order file metadata

## Firestore indexes

Deploy [firestore.indexes.json](/C:/Users/gearz/OneDrive/Documents/New----CODE/AI/vibe__coding/snapcopy/firestore.indexes.json) to support the owner dashboard query:

- `orders.shopId ASC + createdAt DESC`

## S3 notes

- Create a private bucket.
- Make sure `AWS_REGION` matches the bucket's actual region exactly.
- If AWS returns "The bucket you are attempting to access must be addressed using the specified endpoint", set `AWS_S3_ENDPOINT` to the regional endpoint for that bucket, for example `https://s3.ap-south-1.amazonaws.com`.
- Do not expose AWS credentials in the frontend.
- The app uploads files through `app/api/uploads/route.ts`.
- File downloads use short-lived signed URLs from `app/api/orders/files/[fileId]/download/route.ts`.

## Route map

- `/`
- `/login`
- `/select-role`
- `/customer/dashboard`
- `/customer/shop/[shopId]`
- `/shop-owner/setup`
- `/shop-owner/dashboard`

## Deployment notes

- This MVP assumes Node.js runtime for S3 uploads.
- On Vercel or similar platforms, add the same env vars in project settings.
- If Firebase Admin is missing, protected routes and API uploads will fail by design.
- Razorpay Route must be enabled on your Razorpay account.
- Each linked account has a 24-hour cooling period before transfers can be initiated.
- Shop setup now creates the linked account, creates a Route stakeholder, requests the Route product, and updates the settlement configuration with the submitted bank account details. The current integration defaults the linked-account business type to `individual`.
- Customer checkout creates a normal Razorpay order with the full amount.
- After payment verification, the server reads `platform_settings/billing` and calculates the flat transaction fee, estimated processing fee, GST, and transferable amount.
- The server then creates a separate Razorpay Route transfer from the captured payment to the shop owner's linked account.
- Webhooks reconcile `payment.captured`, `transfer.processed`, and `transfer.failed` events.
- Admins can change shop creation fee, transaction fee, gateway fee percent, and GST percent from the Admin panel without a redeploy.

## Limitations by design

- No delivery tracking
- No chat
- No admin panel
- No notifications
- No analytics
- No OCR or printer integration
