import Link from "next/link";

export function ShopOwnerNav({
  active,
}: {
  active: "orders" | "revenue";
}) {
  return (
    <div className="flex w-full gap-2 sm:w-auto">
      <Link
        href="/shop-owner/dashboard"
        className={`${active === "orders" ? "btn-primary" : "btn-secondary"} flex-1 sm:flex-none`}
      >
        Orders
      </Link>
      <Link
        href="/shop-owner/revenue"
        className={`${active === "revenue" ? "btn-primary" : "btn-secondary"} flex-1 sm:flex-none`}
      >
        Revenue
      </Link>
    </div>
  );
}
