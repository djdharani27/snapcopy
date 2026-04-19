import Image from "next/image";
import { CopyShopLinkButton } from "@/components/shop-owner/copy-shop-link-button";
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
    <div className="panel-dark p-5">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#ffc89b]">
        Share QR
      </p>
      <p className="mt-3 text-sm leading-6 text-[#e8d7c8]">
        Customers can scan this QR code to go straight to your upload page.
      </p>
      <div className="mt-4 overflow-hidden rounded-[28px] border border-white/10 bg-white p-4">
        <Image
          src={qrImageUrl}
          alt="Shop QR code"
          width={224}
          height={224}
          className="mx-auto h-56 w-56 rounded-xl"
          unoptimized
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <CopyShopLinkButton url={sharePath} />
        <a href={downloadUrl} className="btn-primary">
          Download QR
        </a>
      </div>
    </div>
  );
}
