import Link from "next/link";

export function CustomerNav({
  active,
}: {
  active: "shops" | "orders";
}) {
  return (
    <div className="flex gap-2">
      <Link
        href="/customer/shops"
        className={active === "shops" ? "btn-primary" : "btn-secondary"}
      >
        Shops
      </Link>
      <Link
        href="/customer/orders"
        className={active === "orders" ? "btn-primary" : "btn-secondary"}
      >
        Orders
      </Link>
    </div>
  );
}
