"use client";

import { useBrowserState } from "@/hooks/useBrowserState";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/useToast";

export function BrowserStateSync() {
  const { isOnline } = useBrowserState();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isOnline) {
      toast.info({
        title: "Offline",
        description: "You are currently offline. Some features may be limited.",
      });
    } else {
      queryClient.refetchQueries({ type: "active" });
    }
  }, [isOnline, queryClient]);

  useEffect(() => {
    const handlePopState = () => {
      queryClient.invalidateQueries({ type: "active" });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [queryClient]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "auth-storage" || e.key === "access_token") {
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey[0];
            return (
              typeof key === "string" &&
              (key === "watchlist" ||
                key === "preferences" ||
                key === "stats" ||
                key === "shows" ||
                key === "movies")
            );
          },
        });
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [queryClient]);

  return null;
}
