"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="btn-secondary"
      disabled={isPending}
      onClick={() => {
        startTransition(() => {
          router.refresh();
        });
      }}
    >
      {isPending ? "Refreshing..." : "Refresh"}
    </button>
  );
}
