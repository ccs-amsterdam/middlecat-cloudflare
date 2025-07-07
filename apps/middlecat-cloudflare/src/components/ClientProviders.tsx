"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";

interface Props {
  children: React.ReactNode;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      gcTime: 1000 * 60 * 60 * 24,
      staleTime: 1000 * 60 * 60 * 24,
      retry: (failureCount: number, e: any) => {
        if (failureCount >= 2) return false;
        const unauthorized = e.response?.status == 401;
        const forbidden = e.response?.status == 403;
        const zodError = e.name === "ZodError";
        const doRetry = !zodError && !unauthorized && !forbidden;
        return doRetry;
      },
    },
  },
});

export default function ClientProviders({ children }: Props) {
  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionProvider>
  );
}
