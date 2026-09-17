"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "./auth";
import { I18nProvider } from "./i18n";
import { ToastProvider } from "./toast";
import { FirebaseAnalytics } from "./firebase";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 10_000, retry: 1, refetchOnWindowFocus: false, gcTime: 5 * 60_000 },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <ToastProvider>
            <FirebaseAnalytics />
            {children}
          </ToastProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
