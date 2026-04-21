import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getShopById } from "@/lib/firebase/firestore-admin";
import { buildShopShareUrl } from "@/lib/utils/url";

function buildDownloadQrSvg(qrMarkup: string) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="720" height="920" viewBox="0 0 720 920" role="img" aria-label="Scan to print SnapCopy QR code">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f8f2ea" />
          <stop offset="100%" stop-color="#efe4d7" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#8c5a3c" flood-opacity="0.12" />
        </filter>
      </defs>
      <rect width="720" height="920" fill="url(#bg)" />
      <rect x="54" y="54" width="612" height="812" rx="40" fill="#fffdf9" stroke="#d7c2af" stroke-width="3" filter="url(#shadow)" />
      <text x="360" y="146" text-anchor="middle" font-family="Manrope, Arial, sans-serif" font-size="36" font-weight="700" fill="#221c18">Scan to print</text>
      <g transform="translate(150 218)">
        <rect x="-22" y="-22" width="464" height="464" rx="28" fill="#ffffff" stroke="#ead9ca" stroke-width="2" />
        ${qrMarkup}
      </g>
      <text x="360" y="814" text-anchor="middle" font-family="Manrope, Arial, sans-serif" font-size="30" font-weight="800" letter-spacing="4" fill="#9c4c20">snapcopy</text>
    </svg>
  `.trim();
}

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
  const headers = new Headers();
  headers.set("Cache-Control", "no-store");

  if (url.searchParams.get("download") === "1") {
    const qrMarkup = await (
      QRCode as unknown as {
        toString: (
          text: string,
          options: {
            type: string;
            errorCorrectionLevel: string;
            margin: number;
            width: number;
            color: {
              dark: string;
              light: string;
            };
          },
        ) => Promise<string>;
      }
    ).toString(shareUrl, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 0,
        width: 420,
        color: {
          dark: "#1d1b19",
          light: "#ffffff",
        },
      },
    );
    const svg = buildDownloadQrSvg(
      qrMarkup
        .replace(/<\?xml[\s\S]*?\?>/g, "")
        .replace(/<!DOCTYPE[\s\S]*?>/g, "")
        .trim(),
    );

    headers.set("Content-Type", "image/svg+xml; charset=utf-8");
    headers.set(
      "Content-Disposition",
      `attachment; filename="${shop.shopName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-qr.svg"`,
    );

    return new Response(svg, { headers });
  }

  const bytes = await QRCode.toBuffer(shareUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 12,
    type: "png",
    width: 600,
  });
  headers.set("Content-Type", "image/png");

  return new Response(new Uint8Array(bytes), { headers });
}
