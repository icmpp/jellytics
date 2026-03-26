"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface Settings {
  jellyfin_server_url: string;
  jellyfin_server_id?: string;
}

export function useSettings() {
  return useQuery<Settings>({
    queryKey: ["settings"],
    queryFn: () => api.get<Settings>("/settings"),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
