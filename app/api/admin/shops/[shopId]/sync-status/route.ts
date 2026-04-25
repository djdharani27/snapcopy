import { NextResponse } from "next/server";
import { ApiAuthError } from "@/lib/auth/errors";
import { requireApiAdmin } from "@/lib/auth/admin";
import { getShopById } from "@/lib/firebase/firestore-admin";
import { syncShopRazorpayStatus } from "@/lib/shops/route-onboarding";

export async function POST(
  request: Request,
  context: { params: Promise<{ shopId: string }> },
) {
  try {
    await requireApiAdmin(request);
    const { shopId } = await context.params;
    const shop = await getShopById(shopId, { includeUnapproved: true });

    if (!shop) {
      return NextResponse.json({ error: "Shop not found." }, { status: 404 });
    }

    const syncedShop = await syncShopRazorpayStatus(shop);

    if (!syncedShop) {
      return NextResponse.json({ error: "Shop not found after sync." }, { status: 404 });
    }

    const message =
      syncedShop.razorpayProductStatus === "needs_clarification" &&
      !syncedShop.razorpayProductRequirements?.length
        ? "Requirements cleared. Waiting for Razorpay to reprocess activation."
        : "Razorpay Route status synced.";

    return NextResponse.json({
      shop: syncedShop,
      message,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to sync Razorpay status." },
      { status: error instanceof ApiAuthError ? error.status : 400 },
    );
  }
}
