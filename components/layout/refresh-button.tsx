"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="icon-btn"
      disabled={isPending}
      aria-label={isPending ? "Refreshing" : "Refresh"}
      title={isPending ? "Refreshing" : "Refresh"}
      suppressHydrationWarning
      onClick={() => {
        startTransition(() => {
          router.refresh();
        });
      }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`h-5 w-5 ${isPending ? "animate-spin" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
    </button>
  );
}
