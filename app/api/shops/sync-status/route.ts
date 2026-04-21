import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import {
  getShopByOwnerId,
  updateShopRazorpayStatus,
} from "@/lib/firebase/firestore-admin";
import {
  fetchRazorpayLinkedAccount,
  fetchRazorpayRouteProductConfiguration,
} from "@/lib/payments/razorpay";

export async function POST() {
  try {
    const { decoded } = await requireApiRole("shop_owner");
    const shop = await getShopByOwnerId(decoded.uid);

    if (!shop) {
      return NextResponse.json({ error: "Shop not found." }, { status: 404 });
    }

    if (!shop.razorpayLinkedAccountId) {
      return NextResponse.json(
        { error: "Linked account is missing for this shop." },
        { status: 400 },
      );
    }

    const linkedAccount = await fetchRazorpayLinkedAccount(shop.razorpayLinkedAccountId);
    let razorpayProductStatus = shop.razorpayProductStatus || "";

    if (shop.razorpayProductId) {
      const product = await fetchRazorpayRouteProductConfiguration({
        accountId: shop.razorpayLinkedAccountId,
        productId: shop.razorpayProductId,
      });
      razorpayProductStatus = product.activation_status;
    }

    const updatedShop = await updateShopRazorpayStatus({
      shopId: shop.id,
      razorpayLinkedAccountStatus: linkedAccount.status,
      razorpayProductStatus,
    });

    return NextResponse.json({ shop: updatedShop });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to sync Razorpay status." },
      { status: 400 },
    );
  }
}
