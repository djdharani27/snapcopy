import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/admin";
import {
  DEFAULT_BILLING_CONFIG,
  getBillingConfig,
  updateBillingConfig,
} from "@/lib/platform/billing";

function parsePaise(value: unknown, field: string) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    throw new Error(`${field} must be a non-negative number.`);
  }

  return Math.round(parsedValue);
}

function parsePercent(value: unknown, field: string) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    throw new Error(`${field} must be a non-negative number.`);
  }

  return parsedValue;
}

export async function GET() {
  try {
    await requireApiAdmin();
    const billing = await getBillingConfig();
    return NextResponse.json({ billing });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load billing settings." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const decoded = await requireApiAdmin();
    const body = await request.json();

    const billing = await updateBillingConfig({
      actorUid: decoded.uid,
      actorEmail: decoded.email || "",
      action: "updated",
      config: {
        shopCreationFeePaise: parsePaise(body.shopCreationFeePaise, "Shop creation fee"),
        transactionFeePaise: parsePaise(body.transactionFeePaise, "Transaction fee"),
        estimatedRazorpayFeePercent: parsePercent(
          body.estimatedRazorpayFeePercent,
          "Estimated Razorpay fee percent",
        ),
        estimatedGstPercent: parsePercent(body.estimatedGstPercent, "Estimated GST percent"),
        shopCreationFeeEnabled: Boolean(body.shopCreationFeeEnabled),
        transactionFeeEnabled: Boolean(body.transactionFeeEnabled),
      },
    });

    return NextResponse.json({ billing });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update billing settings." },
      { status: 400 },
    );
  }
}

export async function POST() {
  try {
    const decoded = await requireApiAdmin();
    const billing = await updateBillingConfig({
      actorUid: decoded.uid,
      actorEmail: decoded.email || "",
      action: "reset_to_defaults",
      config: DEFAULT_BILLING_CONFIG,
    });

    return NextResponse.json({ billing });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to reset billing settings." },
      { status: 400 },
    );
  }
}
