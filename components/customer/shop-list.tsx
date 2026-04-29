"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils/format";
import type { Shop } from "@/types";

export function ShopList({
  shops,
  showPricing = true,
}: {
  shops: Shop[];
  showPricing?: boolean;
}) {
  const [query, setQuery] = useState("");
  const hydrationSafeProps = { suppressHydrationWarning: true as const };

  const filteredShops = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return shops;

    return shops.filter((shop) =>
      [shop.shopName, shop.address, shop.description, shop.services?.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(value),
    );
  }, [query, shops]);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="panel p-4 sm:p-5">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">Explore shops</p>
            <p className="mt-2 text-sm text-[#62584f]">
              Search by shop name, area, or service.
            </p>
          </div>
          <div className="inline-flex w-fit rounded-full bg-[#f6e3d5] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#9c4c20]">
            {filteredShops.length} visible
          </div>
        </div>

        <input
          id="shop-search"
          className="input"
          placeholder="Try: Anna Nagar, color print, thesis binding"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          {...hydrationSafeProps}
        />
      </div>

      {filteredShops.length === 0 ? (
        <div className="panel p-8 text-center text-sm text-slate-600">
          No shops found. Try a different search term.
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredShops.map((shop) => (
            <article
              key={shop.id}
              className="panel flex min-h-[420px] flex-col justify-between p-5 sm:min-h-[440px] sm:p-6"
            >
              <div className="flex flex-1 flex-col gap-5">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#9c4c20]">
                    Print Partner
                  </p>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-[#f5e5d7] px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#9c4c20]">
                    Open
                  </span>
                </div>

                <div className="space-y-3">
                  <h2 className="line-clamp-3 text-xl font-semibold leading-[1.15] tracking-[-0.03em] text-slate-900 sm:text-[1.35rem]">
                    {shop.shopName}
                  </h2>

                  <div className="rounded-[24px] border border-[#eadfd3] bg-[rgba(255,247,239,0.95)] p-4">
                    <p className="line-clamp-2 text-sm leading-6 text-slate-600">
                      {shop.description || "Local Xerox and print service."}
                    </p>
                    <p className="line-clamp-2 mt-3 text-sm leading-6 text-[#6b5d52]">
                      {shop.address}
                    </p>
                  </div>
                </div>

                {showPricing ? (
                  <div className="rounded-[24px] border border-[#eadfd3] bg-[rgba(255,248,240,0.88)] p-4 text-sm text-slate-700">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8e7766]">
                      Starting prices
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <p>B/W single: {formatCurrency(shop.pricing.blackWhiteSingle)}</p>
                      <p>B/W double: {formatCurrency(shop.pricing.blackWhiteDouble)}</p>
                      <p>Color single: {formatCurrency(shop.pricing.colorSingle)}</p>
                      <p>Color double: {formatCurrency(shop.pricing.colorDouble)}</p>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <a href={`tel:${shop.phone}`} className="btn-secondary w-full">
                    Call
                  </a>
                  {shop.googleMapsUrl ? (
                    <a
                      href={shop.googleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary w-full"
                    >
                      Location
                    </a>
                  ) : (
                    <span className="btn-secondary w-full opacity-0" aria-hidden="true">
                      Location
                    </span>
                  )}
                </div>

                <Link href={`/customer/shop/${shop.id}`} className="btn-primary w-full">
                  View shop
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
