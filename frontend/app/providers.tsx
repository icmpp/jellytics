"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2 * 60 * 1000,
            gcTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false, // prevents jarring refetches when switching windows
            refetchOnReconnect: true,
            refetchOnMount: false, // serve from cache to avoid layout jumps on navigation
            placeholderData: (previousData: unknown) => previousData,
            retry: 1,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            networkMode: "online",
          },
          mutations: {
            retry: 1,
            networkMode: "online",
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
