import Link from "next/link";
import { PRINT_CATEGORY_VISUALS } from "@/lib/utils/print-category-visuals";

const LANDING_CARDS = [
  {
    title: "Hall Ticket",
    subtitle: PRINT_CATEGORY_VISUALS.hall_ticket.subtitle,
    href: "/login?next=%2Fcustomer%2Fshops%3Fcategory%3Dhall_ticket",
    imageUrl: PRINT_CATEGORY_VISUALS.hall_ticket.imageUrl,
    icon: PRINT_CATEGORY_VISUALS.hall_ticket.icon,
  },
  {
    title: "Lab Manual",
    subtitle: PRINT_CATEGORY_VISUALS.lab_manual.subtitle,
    href: "/login?next=%2Fcustomer%2Fshops%3Fcategory%3Dlab_manual",
    imageUrl: PRINT_CATEGORY_VISUALS.lab_manual.imageUrl,
    icon: PRINT_CATEGORY_VISUALS.lab_manual.icon,
  },
  {
    title: "Other Prints",
    subtitle: PRINT_CATEGORY_VISUALS.other.subtitle,
    href: "/login?next=%2Fcustomer%2Fshops%3Fcategory%3Dother",
    imageUrl: PRINT_CATEGORY_VISUALS.other.imageUrl,
    icon: PRINT_CATEGORY_VISUALS.other.icon,
  },
];

export default function HomePage() {
  return (
    <main className="page-shell min-h-screen">
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="panel-strong overflow-hidden p-5 sm:p-8 lg:p-10">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="eyebrow">SnapCopy</p>
                <h1 className="mt-3 text-4xl font-semibold tracking-[-0.07em] text-slate-900 sm:text-5xl lg:text-7xl">
                  Order prints the way you order food.
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-[#5f554c] sm:text-lg">
                  Pick what you want, upload one file, see the estimate, and choose a nearby print
                  shop.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/login" className="btn-primary px-6 py-3">
                  Sign in
                </Link>
                <Link href="/customer/orders" className="btn-secondary px-6 py-3">
                  Track orders
                </Link>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {LANDING_CARDS.map((card) => (
                <Link
                  key={card.title}
                  href={card.href}
                  className="group relative overflow-hidden rounded-[32px] border border-[#e9d8cb] shadow-[0_22px_52px_rgba(40,28,19,0.12)]"
                >
                  <div
                    className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
                    style={{ backgroundImage: `url(${card.imageUrl})` }}
                    aria-hidden="true"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[rgba(18,14,11,0.94)] via-[rgba(18,14,11,0.4)] to-[rgba(18,14,11,0.08)]" />
                  <div className="relative flex min-h-[320px] flex-col justify-between p-5 text-white sm:min-h-[380px] sm:p-6">
                    <div className="flex items-start justify-between">
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/18 text-sm font-bold tracking-[0.22em] backdrop-blur">
                        {card.icon}
                      </span>
                      <span className="rounded-full bg-white/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] backdrop-blur">
                        Start
                      </span>
                    </div>

                    <div>
                      <p className="text-3xl font-semibold tracking-[-0.05em]">{card.title}</p>
                      <p className="mt-2 max-w-[15rem] text-sm leading-6 text-white/78">
                        {card.subtitle}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
