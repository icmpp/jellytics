"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface RecommendationItem {
  id: number;
  type: "movie" | "show";
  title: string;
  posterUrl?: string;
  jellyfinId: string;
  completionPercentage?: number;
  reason: string;
}

interface RecommendationsResponse {
  items: RecommendationItem[];
}

export function useRecommendations(limit = 12) {
  return useQuery<RecommendationsResponse>({
    queryKey: ["recommendations", limit],
    queryFn: () => api.get<RecommendationsResponse>(`/recommendations?limit=${limit}`),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
