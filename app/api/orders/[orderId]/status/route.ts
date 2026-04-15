import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import {
  getOrderById,
  getShopByOwnerId,
  updateOrderStatus,
} from "@/lib/firebase/firestore-admin";
import { ORDER_STATUSES } from "@/lib/utils/constants";
import type { OrderStatus } from "@/types";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  try {
    const { decoded } = await requireApiRole("shop_owner");
    const { orderId } = await context.params;
    const { status } = await request.json();

    if (!ORDER_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    const shop = await getShopByOwnerId(decoded.uid);
    const order = await getOrderById(orderId);

    if (!shop || !order || order.shopId !== shop.id) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const updatedOrder = await updateOrderStatus(orderId, status as OrderStatus);
    return NextResponse.json({ order: updatedOrder });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update order." },
      { status: 400 },
    );
  }
}
