import Image from "next/image";
import { buildShopShareUrl } from "@/lib/utils/url";

interface ShopQrCardProps {
  shopId: string;
}

export function ShopQrCard({ shopId }: ShopQrCardProps) {
  const qrImageUrl = `/api/shops/${shopId}/qr`;
  const downloadUrl = `/api/shops/${shopId}/qr?download=1`;
  const shareUrl = buildShopShareUrl(shopId);
  const sharePath = shareUrl || `/s/${shopId}`;

  return (
    <div className="panel p-5">
      <p className="text-sm text-slate-500">Share QR</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Customers can scan this QR code to go straight to your upload page.
      </p>
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4">
        <Image
          src={qrImageUrl}
          alt="Shop QR code"
          width={224}
          height={224}
          className="mx-auto h-56 w-56 rounded-xl"
          unoptimized
        />
      </div>
      <p className="mt-4 break-all text-xs text-slate-500">{sharePath}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <a href={sharePath} className="btn-secondary">
          Open link
        </a>
        <a href={downloadUrl} className="btn-primary">
          Download QR
        </a>
      </div>
    </div>
  );
}
