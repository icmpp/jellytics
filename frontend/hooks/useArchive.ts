"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface ArchiveItem {
  id: number;
  type: "movie" | "show";
  jellyfin_id: string;
  title: string;
  posterUrl?: string;
  year?: number;
  status?: string;
  totalWatchTimeMinutes?: number;
  watchCount?: number;
  removedAt?: string;
}

interface ArchiveResponse {
  movies: ArchiveItem[];
  shows: ArchiveItem[];
}

export function useArchive() {
  return useQuery<ArchiveResponse>({
    queryKey: ["archive"],
    queryFn: () => api.get<ArchiveResponse>("/archive"),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
