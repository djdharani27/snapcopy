import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import { getShopByOwnerId } from "@/lib/firebase/firestore-admin";

export async function POST() {
  try {
    const { decoded } = await requireApiRole("shop_owner");
    const shop = await getShopByOwnerId(decoded.uid);

    if (!shop) {
      return NextResponse.json({ error: "Shop not found." }, { status: 404 });
    }

    return NextResponse.json({
      shop,
      message:
        "Razorpay Route status is managed manually by admins in the dashboard. Ask an admin to update the linked account and Route product fields there.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to sync Razorpay status." },
      { status: 400 },
    );
  }
}
