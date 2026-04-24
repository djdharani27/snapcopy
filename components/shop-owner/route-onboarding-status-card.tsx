"use client";

import Link from "next/link";
import { getRouteOnboardingState } from "@/lib/payments/route-onboarding-status";
import type { Shop } from "@/types";

function getToneClasses(tone: ReturnType<typeof getRouteOnboardingState>["tone"]) {
  switch (tone) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-950";
    case "danger":
      return "border-rose-200 bg-rose-50 text-rose-950";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-950";
    default:
      return "border-slate-200 bg-slate-50 text-slate-900";
  }
}

function getStepBadgeClasses(status: "done" | "current" | "pending") {
  switch (status) {
    case "done":
      return "bg-emerald-100 text-emerald-900";
    case "current":
      return "bg-amber-100 text-amber-900";
    default:
      return "bg-slate-200 text-slate-700";
  }
}

export function RouteOnboardingStatusCard({
  shop,
  compact = false,
}: {
  shop?: Shop | null;
  compact?: boolean;
}) {
  const state = getRouteOnboardingState(shop);

  return (
    <section className={`rounded-[28px] border p-5 ${getToneClasses(state.tone)}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em]">
            Route payout setup
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">{state.title}</h2>
          <p className="mt-3 text-sm leading-6 opacity-85">{state.description}</p>
          {shop?.razorpayStatusLastSyncedAt ? (
            <p className="mt-2 text-xs opacity-75">
              Last synced: {new Date(shop.razorpayStatusLastSyncedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
        {!compact ? (
          <Link href="/shop-owner/setup" className="btn-secondary">
            Review setup
          </Link>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {state.steps.map((step) => (
          <div key={step.label} className="rounded-[22px] border border-current/10 bg-white/70 p-4">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] ${getStepBadgeClasses(step.status)}`}
            >
              {step.status === "done"
                ? "Done"
                : step.status === "current"
                  ? "In progress"
                  : "Pending"}
            </span>
            <p className="mt-3 font-semibold">{step.label}</p>
            <p className="mt-2 text-sm leading-6 opacity-80">{step.detail}</p>
          </div>
        ))}
      </div>

      {state.paymentBlockedReason ? (
        <div className="mt-5 rounded-[22px] border border-current/10 bg-white/70 p-4">
          <p className="text-sm font-semibold">Payment blocked reason</p>
          <p className="mt-2 text-sm leading-6 opacity-85">{state.paymentBlockedReason}</p>
        </div>
      ) : null}

      {state.showCorrectionScreen ? (
        <div className="mt-5 rounded-[22px] border border-current/10 bg-white/70 p-4">
          <p className="text-sm font-semibold">Onboarding correction required</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-[18px] border border-current/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
                Owner PAN
              </p>
              <p className="mt-2 text-sm leading-6 opacity-85">{state.ownerPanStatus}</p>
            </div>
            <div className="rounded-[18px] border border-current/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
                Bank verification
              </p>
              <p className="mt-2 text-sm leading-6 opacity-85">{state.bankVerificationStatus}</p>
            </div>
            <div className="rounded-[18px] border border-current/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
                Route terms
              </p>
              <p className="mt-2 text-sm leading-6 opacity-85">{state.routeTermsStatus}</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 opacity-85">
            Re-submit PAN, account number, IFSC, account holder name, and Route terms acceptance
            from the setup form below. Admins can then update the manual Razorpay details again
            from the dashboard after the correction is saved.
          </p>
        </div>
      ) : null}

      {state.requirements.length > 0 ? (
        <div className="mt-5 rounded-[22px] border border-current/10 bg-white/70 p-4">
          <p className="text-sm font-semibold">Action required from Razorpay review</p>
          <div className="mt-3 space-y-2 text-sm leading-6 opacity-85">
            {state.requirements.map((requirement) => (
              <p key={requirement}>{requirement}</p>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
