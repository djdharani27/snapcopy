"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

type AutoRefreshProps =
  | { customerId: string; shopId?: never }
  | { shopId: string; customerId?: never };

export function AutoRefresh(props: AutoRefreshProps) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const customerId = "customerId" in props ? props.customerId : undefined;
  const shopId = "shopId" in props ? props.shopId : undefined;

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, 8000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [customerId, loading, router, shopId, user]);

  return null;
}
