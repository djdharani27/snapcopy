import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import {
  getShopByOwnerId,
  updateApprovedShopOwnerSettings,
} from "@/lib/firebase/firestore-admin";
import {
  parsePhone,
  parsePostalCode,
  parsePrice,
  parseRequiredText,
  parseServices,
  validateShopPricing,
} from "@/lib/shops/validation";

export async function PATCH(request: Request) {
  try {
    const { decoded } = await requireApiRole("shop_owner");
    const existingShop = await getShopByOwnerId(decoded.uid);

    if (!existingShop) {
      return NextResponse.json({ error: "Shop not found." }, { status: 404 });
    }

    if (existingShop.approvalStatus !== "approved") {
      return NextResponse.json(
        { error: "Shop settings unlock after admin approval." },
        { status: 403 },
      );
    }

    const {
      address,
      city,
      state,
      postalCode,
      phone,
      description,
      services,
      pricing,
    } = await request.json();

    const shop = await updateApprovedShopOwnerSettings({
      shopId: existingShop.id,
      ownerId: decoded.uid,
      address: parseRequiredText(address, "Address"),
      city: parseRequiredText(city, "City"),
      state: parseRequiredText(state, "State"),
      postalCode: parsePostalCode(postalCode),
      phone: parsePhone(phone),
      description: String(description || "").trim(),
      services: parseServices(services),
      pricing: validateShopPricing({
        blackWhiteSingle: parsePrice(pricing?.blackWhiteSingle),
        blackWhiteDouble: parsePrice(pricing?.blackWhiteDouble),
        colorSingle: parsePrice(pricing?.colorSingle),
        colorDouble: parsePrice(pricing?.colorDouble),
      }),
    });

    return NextResponse.json({
      shop,
      message: "Shop pricing and settings updated.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update shop settings." },
      { status: 400 },
    );
  }
}
