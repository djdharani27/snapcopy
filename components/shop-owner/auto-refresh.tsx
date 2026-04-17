"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "@/components/auth/auth-provider";
import { getFirebaseDb, hasFirebaseClientEnv } from "@/lib/firebase/client";

type AutoRefreshProps =
  | { customerId: string; shopId?: never }
  | { shopId: string; customerId?: never };

export function AutoRefresh(props: AutoRefreshProps) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const customerId = "customerId" in props ? props.customerId : undefined;
  const shopId = "shopId" in props ? props.shopId : undefined;

  useEffect(() => {
    if (!hasFirebaseClientEnv() || loading || !user) {
      return;
    }

    const ordersRef = collection(getFirebaseDb(), "orders");
    const ordersQuery =
      customerId
        ? query(ordersRef, where("customerId", "==", customerId))
        : query(ordersRef, where("shopId", "==", shopId!));

    let isInitialSnapshot = true;
    const unsubscribe = onSnapshot(
      ordersQuery,
      () => {
        if (isInitialSnapshot) {
          isInitialSnapshot = false;
          return;
        }

        router.refresh();
      },
      () => {
        // Ignore transient listener failures and avoid noisy console errors in the UI.
      },
    );

    const intervalId = window.setInterval(() => {
      router.refresh();
    }, 8000);

    return () => {
      unsubscribe();
      window.clearInterval(intervalId);
    };
  }, [customerId, loading, router, shopId, user]);

  return null;
}
