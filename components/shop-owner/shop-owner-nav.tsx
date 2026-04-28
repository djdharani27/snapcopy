import Link from "next/link";

export function ShopOwnerNav({
  active,
}: {
  active: "orders" | "revenue" | "settings";
}) {
  return (
    <nav
      aria-label="Shop owner sections"
      className="flex max-w-full flex-wrap items-center gap-1.5"
    >
      <Link
        href="/shop-owner/dashboard"
        aria-current={active === "orders" ? "page" : undefined}
        className={active === "orders" ? "nav-pill-active" : "nav-pill"}
      >
        Orders
      </Link>
      <Link
        href="/shop-owner/revenue"
        aria-current={active === "revenue" ? "page" : undefined}
        className={active === "revenue" ? "nav-pill-active" : "nav-pill"}
      >
        Revenue
      </Link>
      <Link
        href="/shop-owner/settings"
        aria-current={active === "settings" ? "page" : undefined}
        className={active === "settings" ? "nav-pill-active" : "nav-pill"}
      >
        Settings
      </Link>
    </nav>
  );
}
