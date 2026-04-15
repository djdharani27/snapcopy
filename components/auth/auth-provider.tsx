"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { getFirebaseAuth, hasFirebaseClientEnv } from "@/lib/firebase/client";
import { clearClientSession, setClientSession } from "@/lib/auth/client-session";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
});

export async function syncSession(token: string | null) {
  if (!token) {
    await clearClientSession();
    return;
  }

  await setClientSession(token);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => hasFirebaseClientEnv());

  useEffect(() => {
    if (!hasFirebaseClientEnv()) {
      return;
    }

    const unsubscribe = onIdTokenChanged(getFirebaseAuth(), async (nextUser) => {
      setUser(nextUser);

      const token = nextUser ? await nextUser.getIdToken() : null;
      await syncSession(token);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
