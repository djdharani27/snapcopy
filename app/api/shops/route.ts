import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import {
  createShop,
  getAllShops,
  getShopByOwnerId,
  updateShop,
} from "@/lib/firebase/firestore-admin";

function parseServices(value: unknown) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePrice(value: unknown) {
  const numericValue = Number(value);
  if (Number.isNaN(numericValue) || numericValue < 0) {
    throw new Error("Pricing values must be valid non-negative numbers.");
  }
  return numericValue;
}

export async function GET() {
  try {
    await requireApiRole("customer");
    const shops = await getAllShops();
    return NextResponse.json({ shops });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized." },
      { status: 401 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { decoded } = await requireApiRole("shop_owner");
    const {
      shopName,
      address,
      phone,
      description,
      services,
      pricing,
    } = await request.json();

    if (!shopName || !address || !phone) {
      return NextResponse.json(
        { error: "Shop name, address, and phone are required." },
        { status: 400 },
      );
    }

    const shopPricing = {
      blackWhiteSingle: parsePrice(pricing?.blackWhiteSingle),
      blackWhiteDouble: parsePrice(pricing?.blackWhiteDouble),
      colorSingle: parsePrice(pricing?.colorSingle),
      colorDouble: parsePrice(pricing?.colorDouble),
    };

    const shop = await createShop({
      ownerId: decoded.uid,
      shopName: String(shopName).trim(),
      address: String(address).trim(),
      phone: String(phone).trim(),
      description: String(description || "").trim(),
      services: parseServices(services),
      pricing: shopPricing,
    });

    return NextResponse.json({ shop });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { decoded } = await requireApiRole("shop_owner");
    const existingShop = await getShopByOwnerId(decoded.uid);

    if (!existingShop) {
      return NextResponse.json({ error: "Shop not found." }, { status: 404 });
    }

    const {
      shopName,
      address,
      phone,
      description,
      services,
      pricing,
    } = await request.json();

    const shop = await updateShop({
      shopId: existingShop.id,
      ownerId: decoded.uid,
      shopName: String(shopName || "").trim(),
      address: String(address || "").trim(),
      phone: String(phone || "").trim(),
      description: String(description || "").trim(),
      services: parseServices(services),
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
      { error: error instanceof Error ? error.message : "Unable to update shop." },
      { status: 400 },
    );
  }
}
