"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SyncRazorpayStatusButton({
  endpoint,
  className = "btn-secondary",
}: {
  endpoint: string;
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSync() {
    if (loading) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to sync Razorpay status.");
      }

      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to sync Razorpay status.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" onClick={() => void handleSync()} disabled={loading} className={className}>
      {loading ? "Syncing..." : "Sync Razorpay Status"}
    </button>
  );
}
