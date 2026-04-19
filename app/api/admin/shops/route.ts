import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/admin";
import { createShop, getUserProfileById } from "@/lib/firebase/firestore-admin";
import {
  parseGoogleMapsUrl,
  parsePrice,
  parseRazorpayLinkedAccountId,
  parseServices,
} from "@/lib/shops/validation";

export async function POST(request: Request) {
  try {
    await requireApiAdmin();
    const {
      ownerId,
      shopName,
      address,
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

    const shop = await createShop({
      ownerId: owner.uid,
      shopName: String(shopName).trim(),
      address: String(address).trim(),
      googleMapsUrl: parseGoogleMapsUrl(googleMapsUrl),
      phone: String(phone).trim(),
      description: String(description || "").trim(),
      services: parseServices(services),
      razorpayLinkedAccountId: parseRazorpayLinkedAccountId(razorpayLinkedAccountId),
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
      { status: 400 },
    );
  }
}
