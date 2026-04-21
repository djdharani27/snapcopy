import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import { getObjectBytes } from "@/lib/aws/s3";
import {
  getOrderById,
  getOrderFileById,
  getShopByOwnerId,
  markOrderFileDownloaded,
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

    const bytes = await getObjectBytes(file.s3Key);

    await markOrderFileDownloaded({
      fileId: file.id,
      ownerId: decoded.uid,
    });

    const safeFileName = file.originalFileName.replace(/[\r\n"]/g, "").trim() || "file";
    const headers = new Headers();
    headers.set("Content-Type", file.mimeType || "application/octet-stream");
    headers.set("Content-Length", String(bytes.byteLength));
    headers.set("Cache-Control", "no-store");
    headers.set("Content-Disposition", `attachment; filename="${safeFileName}"`);

    return new Response(new Uint8Array(bytes), { headers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to download file." },
      { status: 400 },
    );
  }
}
