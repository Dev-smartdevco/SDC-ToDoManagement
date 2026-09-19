"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { clearToken, endpoints, getToken, setToken } from "./api";

type User = import("./types").AuthUser;

type AuthContextValue = {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const USER_CACHE_KEY = "myos.user";

function readCachedUser(): User | null {
  try {
    const raw = sessionStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: User | null) {
  if (typeof window === "undefined") return;
  if (!user) {
    sessionStorage.removeItem(USER_CACHE_KEY);
    return;
  }
  sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  function resetSession() {
    queryClient.clear();
    clearToken();
    writeCachedUser(null);
    setUser(null);
  }

  useEffect(() => {
    const token = getToken();
    if (!token) {
      queryClient.clear();
      writeCachedUser(null);
      setUser(null);
      setReady(true);
      return;
    }

    const cached = readCachedUser();
    if (cached) {
      setUser(cached);
      setReady(true);
    }

    endpoints
      .me()
      .then((me) => {
        setUser(me);
        writeCachedUser(me);
      })
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
        const result = await endpoints.login(email, password);
        setToken(result.token);
        setUser(result.user);
        writeCachedUser(result.user);
        router.replace(result.user.mustChangePassword ? "/change-password" : "/");
      },
      logout: () => {
        queryClient.clear();
        clearToken();
        writeCachedUser(null);
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
