import Link from "next/link";
import { ShopQrScanButton } from "@/components/customer/shop-qr-scan-button";

export function CustomerNav({
  active,
}: {
  active: "shops" | "orders";
}) {
  return (
    <nav
      aria-label="Customer sections"
      className="flex min-w-max items-center gap-1.5"
    >
      <ShopQrScanButton variant="icon" />
      <Link
        href="/customer/shops"
        aria-current={active === "shops" ? "page" : undefined}
        className={active === "shops" ? "nav-pill-active" : "nav-pill"}
      >
        Shops
      </Link>
      <Link
        href="/customer/orders"
        aria-current={active === "orders" ? "page" : undefined}
        className={active === "orders" ? "nav-pill-active" : "nav-pill"}
      >
        Orders
      </Link>
    </nav>
  );
}
