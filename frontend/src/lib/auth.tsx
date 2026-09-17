"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { clearToken, endpoints, getToken, setToken } from "./api";

type User = { id: string; email: string; name: string };

type AuthContextValue = {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  function resetSession() {
    queryClient.clear();
    queryClient.removeQueries();
    clearToken();
    setUser(null);
  }

  useEffect(() => {
    const token = getToken();
    if (!token) {
      queryClient.clear();
      setReady(true);
      return;
    }
    endpoints
      .me()
      .then((me) => setUser(me))
      .catch(() => {
        resetSession();
      })
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      login: async (email, password) => {
        queryClient.clear();
        queryClient.removeQueries();
        const result = await endpoints.login(email, password);
        setToken(result.token);
        setUser(result.user);
        router.replace("/");
      },
      logout: () => {
        queryClient.clear();
        queryClient.removeQueries();
        clearToken();
        setUser(null);
        router.replace("/login");
      },
    }),
    [user, ready, router, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthProvider missing");
  return ctx;
}

export function useScopedKey(parts: readonly unknown[]) {
  const { user } = useAuth();
  return [user?.id ?? "anon", ...parts];
}
