import { NextResponse } from "next/server";
import { ApiAuthError } from "@/lib/auth/errors";
import { requireApiAdmin } from "@/lib/auth/admin";
import { getShopById, getUserProfileById } from "@/lib/firebase/firestore-admin";
import type { AdminShopSensitivePayoutDetails } from "@/types";

export const dynamic = "force-dynamic";

function getFullAddress(params: {
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}) {
  return [params.address, params.city, params.state, params.postalCode]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ");
}

export async function GET(
  request: Request,
  context: RouteContext<"/api/admin/shops/[shopId]/sensitive-payout-details">,
) {
  try {
    await requireApiAdmin(request);
    const { shopId } = await context.params;
    const shop = await getShopById(shopId, { includeUnapproved: true });

    if (!shop) {
      return NextResponse.json({ error: "Shop not found." }, { status: 404 });
    }

    const owner = await getUserProfileById(shop.ownerId);
    const sensitivePayoutDetails: AdminShopSensitivePayoutDetails = {
      ownerName: String(owner?.name || "").trim(),
      settlementEmail: String(shop.settlementEmail || "").trim(),
      phone: String(shop.phone || "").trim(),
      businessType: String(shop.businessType || "").trim(),
      fullAddress: getFullAddress(shop),
      bankAccountHolderName: String(shop.bankAccountHolderName || "").trim(),
      bankAccountNumber: String(shop.pendingBankAccountNumber || "").trim(),
      bankIfsc: String(shop.bankIfsc || "").trim(),
      ownerPan: String(shop.pendingOwnerPan || "").trim(),
      routeTermsAccepted: Boolean(shop.pendingRouteTermsAccepted || shop.razorpayRouteTermsAccepted),
    };

    return NextResponse.json(
      { sensitivePayoutDetails },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load sensitive payout details.",
      },
      { status: error instanceof ApiAuthError ? error.status : 400 },
    );
  }
}
