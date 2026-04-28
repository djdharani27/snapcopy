import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import {
  getShopByOwnerId,
  updateApprovedShopOwnerPricing,
} from "@/lib/firebase/firestore-admin";
import { parsePrice, validateShopPricing } from "@/lib/shops/validation";

export async function PATCH(request: Request) {
  try {
    const { decoded } = await requireApiRole("shop_owner");
    const existingShop = await getShopByOwnerId(decoded.uid);

    if (!existingShop) {
      return NextResponse.json({ error: "Shop not found." }, { status: 404 });
    }

    if (existingShop.approvalStatus !== "approved") {
      return NextResponse.json(
        { error: "Pricing settings unlock after admin approval." },
        { status: 403 },
      );
    }

    const { pricing } = await request.json();

    const shop = await updateApprovedShopOwnerPricing({
      shopId: existingShop.id,
      ownerId: decoded.uid,
      pricing: validateShopPricing({
        blackWhiteSingle: parsePrice(pricing?.blackWhiteSingle),
        blackWhiteDouble: parsePrice(pricing?.blackWhiteDouble),
        colorSingle: parsePrice(pricing?.colorSingle),
        colorDouble: parsePrice(pricing?.colorDouble),
      }),
    });

    return NextResponse.json({
      shop,
      message: "Shop pricing updated.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update shop pricing." },
      { status: 400 },
    );
  }
}
