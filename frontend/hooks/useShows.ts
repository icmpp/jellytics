"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Show {
  id: number;
  jellyfin_id: string;
  title: string;
  overview: string;
  poster_url: string;
  genre: string;
  year?: number;
  status: "watched" | "watching" | "pending";
  total_episodes?: number;
  watched_episodes: number;
  total_watch_time_minutes: number;
  first_watched_at?: string;
  last_watched_at?: string;
  created_at: string;
  removed_from_library?: boolean;
}

interface ShowsResponse {
  shows: Show[];
  total: number;
}

interface UseShowsFilters {
  status?: string;
  search?: string;
  genre?: string;
  yearFrom?: number;
  yearTo?: number;
  watchedFrom?: string;
  watchedTo?: string;
  tags?: number[];
  limit?: number;
  offset?: number;
}

export function useShows(filters?: UseShowsFilters, options?: { enabled?: boolean }) {
  const params = new URLSearchParams();
  if (filters?.status) params.append("status", filters.status);
  if (filters?.search) params.append("search", filters.search);
  if (filters?.genre) params.append("genre", filters.genre);
  if (filters?.yearFrom) params.append("year_from", filters.yearFrom.toString());
  if (filters?.yearTo) params.append("year_to", filters.yearTo.toString());
  if (filters?.watchedFrom) params.append("watched_from", filters.watchedFrom);
  if (filters?.watchedTo) params.append("watched_to", filters.watchedTo);
  if (filters?.tags?.length) params.append("tags", filters.tags.join(","));
  if (filters?.limit !== undefined && filters?.limit !== null) {
    params.append("limit", filters.limit.toString());
  }
  if (filters?.offset !== undefined && filters?.offset !== null) {
    params.append("offset", filters.offset.toString());
  }

  return useQuery<ShowsResponse>({
    queryKey: ["shows", filters],
    queryFn: () => api.get<ShowsResponse>(`/shows?${params.toString()}`),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

const DEFAULT_PAGE_SIZE = 50;

/** Infinite query for shows with Load more support. */
export function useShowsInfinite(
  filters?: Omit<UseShowsFilters, "limit" | "offset">,
  pageSize = DEFAULT_PAGE_SIZE,
  options?: { enabled?: boolean },
) {
  return useInfiniteQuery({
    queryKey: ["shows", "infinite", filters, pageSize],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (filters?.status) params.append("status", filters.status);
      if (filters?.search) params.append("search", filters.search);
      if (filters?.genre) params.append("genre", filters.genre);
      if (filters?.yearFrom) params.append("year_from", filters.yearFrom.toString());
      if (filters?.yearTo) params.append("year_to", filters.yearTo.toString());
      if (filters?.watchedFrom) params.append("watched_from", filters.watchedFrom);
      if (filters?.watchedTo) params.append("watched_to", filters.watchedTo);
      if (filters?.tags?.length) params.append("tags", filters.tags.join(","));
      params.append("limit", pageSize.toString());
      params.append("offset", pageParam.toString());
      return api.get<ShowsResponse>(`/shows?${params.toString()}`);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + p.shows.length, 0);
      if (loaded >= lastPage.total) return undefined;
      return loaded;
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

export interface ShowDetailResponse {
  show: Show;
  episodes: Episode[];
}

export interface Episode {
  id: number;
  show_id: number;
  jellyfin_id: string;
  title: string;
  episode_number: number;
  season_number: number;
  duration_minutes?: number;
  watched: boolean;
  watched_at?: string;
  watch_count: number;
  completion_percentage?: number;
  created_at: string;
}

export function useShow(id: number) {
  return useQuery<ShowDetailResponse>({
    queryKey: ["shows", id],
    queryFn: () => api.get<ShowDetailResponse>(`/shows/${id}`),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useDeleteShow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (showId: number) => api.delete(`/shows/${showId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["history"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
      queryClient.invalidateQueries({ queryKey: ["archive"] });
    },
  });
}

export function useRestoreShow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (showId: number) => api.post(`/shows/${showId}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["history"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
      queryClient.invalidateQueries({ queryKey: ["archive"] });
    },
  });
}
