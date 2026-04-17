import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getShopById } from "@/lib/firebase/firestore-admin";
import { buildShopShareUrl } from "@/lib/utils/url";

export async function GET(
  request: Request,
  context: { params: Promise<{ shopId: string }> },
) {
  const { shopId } = await context.params;
  const shop = await getShopById(shopId);

  if (!shop) {
    return NextResponse.json({ error: "Shop not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const shareUrl = buildShopShareUrl(shopId, url.origin);
  const bytes = await QRCode.toBuffer(shareUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 12,
    type: "png",
    width: 600,
  });
  const headers = new Headers();
  headers.set("Content-Type", "image/png");
  headers.set("Cache-Control", "no-store");

  if (url.searchParams.get("download") === "1") {
    headers.set(
      "Content-Disposition",
      `attachment; filename="${shop.shopName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-qr.png"`,
    );
  }

  return new Response(new Uint8Array(bytes), { headers });
}
