import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { PrintMarketplace } from "@/components/customer/print-marketplace";
import { getAllShops } from "@/lib/firebase/firestore-admin";
import { requireRole } from "@/lib/auth/session";

export default async function CustomerShopsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  noStore();

  const { profile } = await requireRole("customer");
  const shops = await getAllShops();
  const { category } = await searchParams;
  const initialCategory =
    category === "hall_ticket" || category === "lab_manual" || category === "other"
      ? category
      : undefined;

  return (
    <main className="page-shell min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 rounded-[32px] border border-[rgba(95,77,59,0.12)] bg-[rgba(255,252,248,0.84)] px-5 py-5 shadow-[0_24px_80px_rgba(47,33,18,0.12)] backdrop-blur sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#221c18] text-sm font-bold uppercase tracking-[0.2em] text-[#fff2e4]">
                  SC
                </span>
                <div>
                  <p className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
                    SnapCopy
                  </p>
                  <p className="text-xs uppercase tracking-[0.22em] text-[#8b7564]">
                    Print marketplace
                  </p>
                </div>
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link href="/customer/orders" className="btn-secondary">
                My orders
              </Link>
              <Link href="/" className="btn-secondary">
                Home
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="eyebrow">Nearest shops, live estimate, one-file order</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-slate-900 sm:text-5xl">
                Browse prints like a marketplace, not a form.
              </h1>
            </div>
            <div className="rounded-[24px] bg-[rgba(255,245,235,0.9)] px-4 py-3 text-sm text-[#6b5d52]">
              Signed in as <span className="font-semibold text-slate-900">{profile.name}</span>
            </div>
          </div>
        </header>

        <PrintMarketplace shops={shops} profile={profile} initialCategory={initialCategory} />
      </div>
    </main>
  );
}
