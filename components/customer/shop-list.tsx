"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils/format";
import type { Shop } from "@/types";

export function ShopList({ shops }: { shops: Shop[] }) {
  const [query, setQuery] = useState("");

  const filteredShops = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return shops;

    return shops.filter((shop) =>
      [shop.shopName, shop.address, shop.description]
        .join(" ")
        .toLowerCase()
        .includes(value),
    );
  }, [query, shops]);

  return (
    <div className="space-y-5">
      <div className="panel p-5">
        <label className="label" htmlFor="shop-search">
          Search shops
        </label>
        <input
          id="shop-search"
          className="input"
          placeholder="Search by shop name or area"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {filteredShops.length === 0 ? (
        <div className="panel p-8 text-center text-sm text-slate-600">
          No shops found. Try a different search term.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {filteredShops.map((shop) => (
            <article key={shop.id} className="panel p-6">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-slate-900">
                  {shop.shopName}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {shop.description || "Local Xerox and print service."}
                </p>
              </div>

              <div className="space-y-2 text-sm text-slate-600">
                <p>{shop.address}</p>
                <p>{shop.phone}</p>
              </div>

              <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Starting prices</p>
                <p className="mt-2">
                  B/W single: {formatCurrency(shop.pricing.blackWhiteSingle)}
                </p>
                <p>B/W double: {formatCurrency(shop.pricing.blackWhiteDouble)}</p>
                <p>Color single: {formatCurrency(shop.pricing.colorSingle)}</p>
                <p>Color double: {formatCurrency(shop.pricing.colorDouble)}</p>
              </div>

              <Link
                href={`/customer/shop/${shop.id}`}
                className="btn-primary mt-6 w-full"
              >
                Send documents
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
