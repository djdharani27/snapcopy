import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/admin";
import { deleteS3Objects } from "@/lib/aws/s3";
import {
  deleteShopWithRelatedData,
  getShopById,
  updateShopApproval,
} from "@/lib/firebase/firestore-admin";
import { approveShopAndRunRouteOnboarding } from "@/lib/shops/route-onboarding";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/admin/shops/[shopId]">,
) {
  try {
    await requireApiAdmin();
    const { shopId } = await context.params;
    const { action } = await request.json();
    const shop = await getShopById(shopId, { includeUnapproved: true });

    if (!shop) {
      return NextResponse.json({ error: "Shop not found." }, { status: 404 });
    }

    if (action === "approve") {
      const approvedShop = await approveShopAndRunRouteOnboarding(shop);
      return NextResponse.json({ shop: approvedShop });
    }

    if (action === "reject") {
      const rejectedShop = await updateShopApproval({
        shopId: shop.id,
        approvalStatus: "rejected",
      });
      return NextResponse.json({ shop: rejectedShop });
    }

    return NextResponse.json({ error: "Invalid admin action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update approval." },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/admin/shops/[shopId]">,
) {
  try {
    await requireApiAdmin();
    const { shopId } = await context.params;
    const result = await deleteShopWithRelatedData(shopId);
    const deletedS3ObjectCount = await deleteS3Objects(result.s3Keys);

    return NextResponse.json({
      success: true,
      deletedOrderCount: result.deletedOrderCount,
      deletedFileCount: result.deletedFileCount,
      deletedS3ObjectCount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete shop." },
      { status: 400 },
    );
  }
}
