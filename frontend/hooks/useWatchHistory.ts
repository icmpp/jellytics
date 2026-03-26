"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface WatchHistoryItem {
  id: string;
  type: "episode" | "movie";
  title: string;
  showTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  watchedAt: string;
  firstWatchedAt?: string;
  duration?: number;
  totalWatchTime?: number;
  watchCount?: number;
  completionPercentage?: number;
  status?: string;
  posterUrl?: string;
  showId?: number;
  movieId?: number;
  removedFromLibrary?: boolean;
}

interface HistoryResponse {
  items: WatchHistoryItem[];
  total: number;
}

interface UseWatchHistoryOptions {
  limit?: number;
  type?: "all" | "episode" | "movie";
}

export function useWatchHistory(limitOrOptions: number | UseWatchHistoryOptions = 100) {
  const opts =
    typeof limitOrOptions === "number"
      ? { limit: limitOrOptions }
      : { limit: 100, ...limitOrOptions };
  const { limit, type } = opts;

  const params = new URLSearchParams();
  params.set("limit", limit.toString());
  if (type && type !== "all") params.set("type", type);

  const { data, isLoading, isError, refetch } = useQuery<HistoryResponse>({
    queryKey: ["history", limit, type],
    queryFn: () => api.get<HistoryResponse>(`/history?${params.toString()}`),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  return {
    data: data?.items ?? [],
    isLoading,
    isError,
    refetch,
  };
}
