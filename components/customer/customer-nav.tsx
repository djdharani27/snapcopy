import Link from "next/link";

export function CustomerNav({
  active,
}: {
  active: "shops" | "orders";
}) {
  return (
    <div className="flex w-full gap-2 sm:w-auto">
      <Link
        href="/customer/shops"
        className={`${active === "shops" ? "btn-primary" : "btn-secondary"} flex-1 sm:flex-none`}
      >
        Shops
      </Link>
      <Link
        href="/customer/orders"
        className={`${active === "orders" ? "btn-primary" : "btn-secondary"} flex-1 sm:flex-none`}
      >
        Orders
      </Link>
    </div>
  );
}
