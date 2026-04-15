import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import { createShop, getAllShops } from "@/lib/firebase/firestore-admin";

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
    const { shopName, address, phone, description } = await request.json();

    if (!shopName || !address || !phone) {
      return NextResponse.json(
        { error: "Shop name, address, and phone are required." },
        { status: 400 },
      );
    }

    const shop = await createShop({
      ownerId: decoded.uid,
      shopName: String(shopName).trim(),
      address: String(address).trim(),
      phone: String(phone).trim(),
      description: String(description || "").trim(),
    });

    return NextResponse.json({ shop });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized." },
      { status: 400 },
    );
  }
}
