import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import { getDownloadUrl } from "@/lib/aws/s3";
import {
  getOrderById,
  getOrderFileById,
  getShopByOwnerId,
  updateOrderStatus,
} from "@/lib/firebase/firestore-admin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ fileId: string }> },
) {
  try {
    const { decoded } = await requireApiRole("shop_owner");
    const { fileId } = await context.params;

    const shop = await getShopByOwnerId(decoded.uid);
    const file = await getOrderFileById(fileId);

    if (!shop || !file) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }

    const order = await getOrderById(file.orderId);
    if (!order || order.shopId !== shop.id) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }

    if (order.status === "pending") {
      await updateOrderStatus(order.id, "downloaded");
    }

    const url = await getDownloadUrl(file.s3Key);
    return NextResponse.redirect(new URL(url));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to download file." },
      { status: 400 },
    );
  }
}
