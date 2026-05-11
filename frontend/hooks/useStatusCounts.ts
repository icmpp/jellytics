"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface StatusCounts {
  all: number;
  watched: number;
  watching: number;
  pending: number;
}

export interface UseStatusCountsFilters {
  search?: string;
  genre?: string;
  yearFrom?: number;
  yearTo?: number;
  watchedFrom?: string;
  watchedTo?: string;
  tags?: number[];
}

function buildParams(filters: UseStatusCountsFilters = {}) {
  const p = new URLSearchParams();
  if (filters.search) p.append("search", filters.search);
  if (filters.genre) p.append("genre", filters.genre);
  if (filters.yearFrom) p.append("year_from", String(filters.yearFrom));
  if (filters.yearTo) p.append("year_to", String(filters.yearTo));
  if (filters.watchedFrom) p.append("watched_from", filters.watchedFrom);
  if (filters.watchedTo) p.append("watched_to", filters.watchedTo);
  if (filters.tags?.length) p.append("tags", filters.tags.join(","));
  return p;
}

/**
 * Per-status counts for the movies or shows library, respecting the supplied
 * filters (except status itself). Used by the segmented status control.
 */
export function useStatusCounts(
  mediaType: "movies" | "shows",
  filters: UseStatusCountsFilters = {},
) {
  const params = buildParams(filters);

  return useQuery<StatusCounts>({
    queryKey: [mediaType, "status-counts", filters],
    queryFn: () => api.get<StatusCounts>(`/${mediaType}/status-counts?${params.toString()}`),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
}
