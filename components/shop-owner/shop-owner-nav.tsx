import Link from "next/link";

export function ShopOwnerNav({
  active,
}: {
  active: "orders" | "revenue";
}) {
  return (
    <div className="flex gap-2">
      <Link
        href="/shop-owner/dashboard"
        className={active === "orders" ? "btn-primary" : "btn-secondary"}
      >
        Orders
      </Link>
      <Link
        href="/shop-owner/revenue"
        className={active === "revenue" ? "btn-primary" : "btn-secondary"}
      >
        Revenue
      </Link>
    </div>
  );
}
