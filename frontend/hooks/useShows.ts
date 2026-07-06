"use client";

import React from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "@/hooks/useToast";
import { ToastAction } from "@/components/ui/toast";
import type { ArchiveResponse } from "@/hooks/useArchive";

export interface UpNext {
  episode_id: number;
  season_number: number;
  episode_number: number;
  title?: string;
}

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
  up_next?: UpNext | null;
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
  sort?: string;
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
  if (filters?.sort) params.append("sort", filters.sort);
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
      if (filters?.sort) params.append("sort", filters.sort);
      params.append("limit", pageSize.toString());
      params.append("offset", pageParam.toString());
      return api.get<ShowsResponse>(`/shows?${params.toString()}`);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + (p.shows?.length ?? 0), 0);
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

  // Undo a restore by re-archiving (the inverse of restore — archive is reversible).
  const reArchive = async (showId: number) => {
    try {
      await api.delete(`/shows/${showId}`);
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      queryClient.invalidateQueries({ queryKey: ["archive"] });
    } catch (err) {
      console.error("Failed to undo restore:", err);
      toast.error({ title: "Error", description: "Failed to undo. Please try again." });
    }
  };

  return useMutation({
    mutationFn: (showId: number) => api.post(`/shows/${showId}/restore`),
    onMutate: async (showId) => {
      await queryClient.cancelQueries({ queryKey: ["archive"] });
      const previousArchive = queryClient.getQueryData<ArchiveResponse>(["archive"]);
      const removedItem = previousArchive?.shows.find((s) => s.id === showId);
      if (previousArchive) {
        queryClient.setQueryData<ArchiveResponse>(["archive"], {
          ...previousArchive,
          shows: previousArchive.shows.filter((s) => s.id !== showId),
        });
      }
      return { previousArchive, removedItem };
    },
    onError: (error, _showId, context) => {
      if (context?.previousArchive) {
        queryClient.setQueryData<ArchiveResponse>(["archive"], context.previousArchive);
      }
      console.error("Failed to restore from archive:", error);
      toast.error({ title: "Error", description: "Failed to restore. Please try again." });
    },
    onSuccess: (_data, showId, context) => {
      toast.success({
        title: "Restored to library",
        description: `"${context?.removedItem?.title ?? "Item"}" has been restored to your library.`,
        action: React.createElement(
          ToastAction,
          { altText: "Undo restore", onClick: () => reArchive(showId) },
          "Undo",
        ),
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["history"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
      queryClient.invalidateQueries({ queryKey: ["archive"] });
    },
  });
}
