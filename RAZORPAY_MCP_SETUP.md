# Razorpay MCP Setup

This project already uses Razorpay in backend APIs. MCP is for local AI-assisted inspection and debugging only. Do not move production payment execution, verification, or webhook reconciliation into MCP.

## Current Backend Payment Flow

Backend/payment logic currently lives here:

- `app/api/orders/create/route.ts`: creates Razorpay orders on the server after auth, order checks, pricing checks, and linked-account readiness checks.
- `app/api/payments/verify/route.ts`: verifies the Razorpay checkout signature on the server and marks the order paid.
- `app/api/webhooks/razorpay/route.ts`: verifies webhook signatures, deduplicates webhook events, reconciles captured payments, transfers, and refunds.
- `app/api/transfers/create/route.ts`: admin-only transfer retry entrypoint.
- `app/api/admin/orders/[orderId]/retry-transfer/route.ts`: admin-only retry for a specific order transfer.
- `lib/payments/razorpay.ts`: server-side Razorpay API client helpers and HMAC verification.
- `lib/payments/transfers.ts`: server-side payout/transfer reconciliation logic.
- `lib/payments/transfer-calculation.ts`: server-side commission, gateway-fee, tax, and transferable amount calculations.
- `lib/shops/route-onboarding.ts`: server-side linked-account, stakeholder, and Route product onboarding.

## What MCP Is For

Use Razorpay MCP for:

- inspecting linked accounts and Route onboarding state
- checking orders, payments, refunds, settlements, and payout-related errors
- comparing Razorpay-side data with your Firestore order state
- debugging failed captures, failed transfers, refund state, and settlement mismatches

Official Razorpay MCP tools cover these categories:

- Payments
- Orders
- Payment Links
- Refunds
- QR Codes
- Settlements
- Payouts
- Standard Checkout integration helpers

Do not use Razorpay MCP as the production payment backend for this app.

## What Must Stay In Backend APIs/Webhooks

These must remain in your app backend:

- order creation for checkout
- payment signature verification
- webhook signature verification and event processing
- transfer/commission/settlement calculations
- writing order/payment/refund/transfer state into Firestore
- admin-only retry operations and authorization checks

The frontend should only open Razorpay Checkout and send the resulting payment payload back to backend verification endpoints. It must not hold the secret key, webhook secret, payout logic, or settlement logic.

## Required Environment Variables

For this repo:

```env
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
NEXT_PUBLIC_RAZORPAY_KEY_ID=
RAZORPAY_WEBHOOK_SECRET=
```

For the app's checkout flow, keep:

```env
NEXT_PUBLIC_RAZORPAY_KEY_ID=$RAZORPAY_KEY_ID
```

`RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` must stay server-only. Do not expose them to the frontend, browser bundles, screenshots, logs, or commits.

## Test Vs Live Warning

Use Razorpay test keys only for local development and MCP debugging. Razorpay documents that test keys start with `rzp_test_`, while live keys start with `rzp_live_`.

For this project:

- local MCP debugging: use test keys only
- local app checkout testing: use test keys only
- production backend/webhooks: keep using your normal production backend flow with live keys only in the deployed environment

If any live key was ever committed to this repo or copied into an example file, rotate it in Razorpay immediately.

## Official Razorpay MCP Options

Per Razorpay's official docs, there are two supported MCP setups:

- Remote MCP server via `npx mcp-remote https://mcp.razorpay.com/mcp`
- Local MCP server via Docker using the official `razorpay/mcp` image

Remote is the official recommended option. Local Docker is useful when you want self-hosting or access to tools marked local-only in the official repo.

## Connect Razorpay MCP In Cursor

Official Razorpay remote MCP config:

```json
{
  "mcpServers": {
    "rzp-mcp-server": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://mcp.razorpay.com/mcp",
        "--header",
        "Authorization:${AUTH_HEADER}"
      ],
      "env": {
        "AUTH_HEADER": "Basic <Base64(key:secret)>"
      }
    }
  }
}
```

Exact next steps:

1. Generate a base64 token from your Razorpay test key and test secret.
2. Open Cursor settings.
3. Go to MCP tools and add a custom MCP server.
4. Paste the config above.
5. Replace `AUTH_HEADER` with the test-mode `Basic` token value.
6. Restart Cursor or reload MCP tools.
7. Ask Cursor to inspect test orders, payments, refunds, settlements, or linked-account state.

## Connect Razorpay MCP In Claude Desktop

Official Razorpay remote MCP config:

```json
{
  "mcpServers": {
    "rzp-mcp-server": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://mcp.razorpay.com/mcp",
        "--header",
        "Authorization: Basic <Merchant Token>"
      ]
    }
  }
}
```

Exact next steps:

1. Generate the merchant token from your Razorpay test key and test secret.
2. Open Claude Desktop.
3. Go to Settings -> Developer -> Edit Config.
4. Paste the config above into `claude_desktop_config.json`.
5. Replace `<Merchant Token>` with the test-mode token.
6. Save the file and restart Claude Desktop.
7. Use Claude to inspect Razorpay test orders, payments, refunds, settlements, and Route data.

## Connect Razorpay MCP In Codex

Razorpay's official MCP docs currently document Cursor, Claude Desktop, and VS Code. They do not publish a Codex-specific configuration snippet.

Practical next steps:

1. Use the same Razorpay remote MCP endpoint from the official docs: `https://mcp.razorpay.com/mcp`.
2. Use the same auth format from the official docs: `Authorization: Basic <base64(test_key:test_secret)>`.
3. Add that server in whatever MCP configuration surface your Codex client exposes.
4. Keep the credentials in a local env/config file, not in repo files.

The Codex-specific wiring above is an inference from Razorpay's documented remote server requirements, not a Razorpay-published Codex example.

## Optional Local Docker MCP Setup

Official Docker-based local MCP config requires these env vars:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `LOG_FILE` (optional)
- `TOOLSETS` (optional, defaults to `all`)
- `READ_ONLY` (optional, defaults to `false`)

For safer inspection-only debugging, prefer `READ_ONLY=true` unless you intentionally need write operations such as refunds or other state-changing calls.

Example local Docker shape from Razorpay's docs/repo:

```json
{
  "mcpServers": {
    "razorpay-mcp-server": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-e",
        "RAZORPAY_KEY_ID",
        "-e",
        "RAZORPAY_KEY_SECRET",
        "razorpay/mcp"
      ],
      "env": {
        "RAZORPAY_KEY_ID": "your_razorpay_key_id",
        "RAZORPAY_KEY_SECRET": "your_razorpay_key_secret"
      }
    }
  }
}
```

If you choose local Docker for debugging this app, still use test keys only.

## Safety Review For This Repo

Verified:

- Razorpay order creation is server-side in `app/api/orders/create/route.ts`.
- Razorpay payment verification is server-side in `app/api/payments/verify/route.ts`.
- Webhook handling exists in `app/api/webhooks/razorpay/route.ts`.
- Webhook handling now covers `payment.captured` and `payment.failed` with idempotent event processing.
- Commission and settlement logic is server-side in `lib/payments/transfers.ts` and `lib/payments/transfer-calculation.ts`.
- Frontend checkout only receives the public key id and posts the payment result back to backend verification.

Unsafe item found:

- `.env.local.example` contained committed live Razorpay credential values. Those values were removed from the example file and should be rotated if they were real.

## How To Test

1. Copy `.env.example` values into your local `.env.local` or local MCP client config.
2. Set test-mode Razorpay credentials only.
3. For app checkout, set `NEXT_PUBLIC_RAZORPAY_KEY_ID=$RAZORPAY_KEY_ID` locally.
4. Create or approve a shop and pay the Rs. 49 shop subscription in test mode.
5. Verify the shop becomes active with `subscriptionStatus=active` and a future `subscriptionValidUntil`.
6. Create a customer print order for that active shop.
7. Complete checkout with Razorpay test mode.
8. Verify the backend marks the order paid through `app/api/payments/verify/route.ts`.
9. Verify Firestore stores `printCostPaise`, `platformFeePaise=100`, `totalAmountPaise`, `shopEarningPaise`, `platformEarningPaise=100`, and `settlementStatus=pending`.
10. Use the admin panel to mark settlement paid and verify `settlementPaidAt` is stored.
11. Trigger or inspect webhook delivery against `app/api/webhooks/razorpay/route.ts`.
12. Use MCP to fetch the same order/payment/refund/settlement objects and compare them with Firestore state.

## Sources

- Razorpay MCP overview: https://razorpay.com/docs/mcp-server
- Razorpay remote MCP setup: https://razorpay.com/docs/mcp-server/remote/
- Razorpay MCP configuration: https://razorpay.com/docs/mcp-server/configuration/
- Razorpay MCP FAQs: https://razorpay.com/docs/mcp-server/faqs/
- Official Razorpay MCP repo: https://github.com/razorpay/razorpay-mcp-server
