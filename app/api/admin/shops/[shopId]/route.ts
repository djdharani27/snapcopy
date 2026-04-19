import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/admin";
import { deleteS3Objects } from "@/lib/aws/s3";
import { deleteShopWithRelatedData } from "@/lib/firebase/firestore-admin";

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
