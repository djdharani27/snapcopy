import { NextResponse } from "next/server";
import { ApiAuthError } from "@/lib/auth/errors";
import { requireApiAdmin } from "@/lib/auth/admin";
import { createShop, getUserProfileById } from "@/lib/firebase/firestore-admin";
import {
  parseGoogleMapsUrl,
  parsePhone,
  parsePrice,
  parsePostalCode,
  parseRequiredText,
  parseRazorpayLinkedAccountId,
  parseServices,
} from "@/lib/shops/validation";

export async function POST(request: Request) {
  try {
    await requireApiAdmin(request);
    const {
      ownerId,
      shopName,
      address,
      city,
      state,
      postalCode,
      googleMapsUrl,
      phone,
      description,
      services,
      razorpayLinkedAccountId,
      pricing,
    } = await request.json();

    if (!ownerId || !shopName || !address || !phone) {
      return NextResponse.json(
        { error: "Owner, shop name, address, and phone are required." },
        { status: 400 },
      );
    }

    const owner = await getUserProfileById(String(ownerId).trim());
    if (!owner || owner.role !== "shop_owner") {
      return NextResponse.json(
        { error: "Selected owner must be an existing shop owner." },
        { status: 400 },
      );
    }

    const parsedShopName = String(shopName).trim();
    const parsedAddress = String(address).trim();
    const parsedCity = parseRequiredText(city, "City");
    const parsedState = parseRequiredText(state, "State");
    const parsedPostalCode = parsePostalCode(postalCode);
    const parsedPhone = parsePhone(phone);
    const parsedLinkedAccountId = String(razorpayLinkedAccountId || "").trim()
      ? parseRazorpayLinkedAccountId(razorpayLinkedAccountId)
      : "";

    const shop = await createShop({
      ownerId: owner.uid,
      shopName: parsedShopName,
      address: parsedAddress,
      city: parsedCity,
      state: parsedState,
      postalCode: parsedPostalCode,
      googleMapsUrl: parseGoogleMapsUrl(googleMapsUrl),
      phone: parsedPhone,
      description: String(description || "").trim(),
      services: parseServices(services),
      razorpayLinkedAccountId: parsedLinkedAccountId,
      onlinePaymentsEnabled: false,
      paymentOnboardingNote: "",
      pricing: {
        blackWhiteSingle: parsePrice(pricing?.blackWhiteSingle),
        blackWhiteDouble: parsePrice(pricing?.blackWhiteDouble),
        colorSingle: parsePrice(pricing?.colorSingle),
        colorDouble: parsePrice(pricing?.colorDouble),
      },
    });

    return NextResponse.json({ shop });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create shop." },
      { status: error instanceof ApiAuthError ? error.status : 400 },
    );
  }
}
