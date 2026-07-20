"use client";

import React from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "@/hooks/useToast";
import { ToastAction } from "@/components/ui/toast";
import type { ArchiveResponse } from "@/hooks/useArchive";

export interface Movie {
  id: number;
  jellyfin_id: string;
  title: string;
  overview: string;
  poster_url: string;
  backdrop_url: string;
  genre: string;
  year?: number;
  imdb_id: string;
  tmdb_id: string;
  runtime_minutes?: number;
  status: "watched" | "watching" | "pending";
  watched: boolean;
  watch_count: number;
  total_watch_time_minutes: number;
  completion_percentage: number;
  first_watched_at?: string;
  last_watched_at?: string;
  created_at: string;
  removed_from_library?: boolean;
  /** True when the item was deleted from Jellyfin and archived. */
  deleted_from_jellyfin?: boolean;
  /** ISO timestamp of when it was archived (deleted from Jellyfin). */
  archived_at?: string;
}

interface MoviesResponse {
  movies: Movie[];
  total: number;
}

interface UseMoviesFilters {
  status?: string;
  search?: string;
  genre?: string;
  yearFrom?: number;
  yearTo?: number;
  watchedFrom?: string;
  watchedTo?: string;
  tags?: number[];
  archived?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}

export function useMovies(filters?: UseMoviesFilters, options?: { enabled?: boolean }) {
  const params = new URLSearchParams();
  if (filters?.status) params.append("status", filters.status);
  if (filters?.search) params.append("search", filters.search);
  if (filters?.genre) params.append("genre", filters.genre);
  if (filters?.yearFrom) params.append("year_from", filters.yearFrom.toString());
  if (filters?.yearTo) params.append("year_to", filters.yearTo.toString());
  if (filters?.watchedFrom) params.append("watched_from", filters.watchedFrom);
  if (filters?.watchedTo) params.append("watched_to", filters.watchedTo);
  if (filters?.tags?.length) params.append("tags", filters.tags.join(","));
  if (filters?.archived) params.append("archived", filters.archived);
  if (filters?.sort) params.append("sort", filters.sort);
  if (filters?.limit !== undefined && filters?.limit !== null) {
    params.append("limit", filters.limit.toString());
  }
  if (filters?.offset !== undefined && filters?.offset !== null) {
    params.append("offset", filters.offset.toString());
  }

  return useQuery<MoviesResponse>({
    queryKey: ["movies", filters],
    queryFn: () => api.get<MoviesResponse>(`/movies?${params.toString()}`),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

const DEFAULT_PAGE_SIZE = 50;

/** Infinite query for movies with Load more support. */
export function useMoviesInfinite(
  filters?: Omit<UseMoviesFilters, "limit" | "offset">,
  pageSize = DEFAULT_PAGE_SIZE,
  options?: { enabled?: boolean },
) {
  return useInfiniteQuery({
    queryKey: ["movies", "infinite", filters, pageSize],
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
      if (filters?.archived) params.append("archived", filters.archived);
      if (filters?.sort) params.append("sort", filters.sort);
      params.append("limit", pageSize.toString());
      params.append("offset", pageParam.toString());
      return api.get<MoviesResponse>(`/movies?${params.toString()}`);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + (p.movies?.length ?? 0), 0);
      if (loaded >= lastPage.total) return undefined;
      return loaded;
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

export function useMovie(id: number) {
  return useQuery<Movie>({
    queryKey: ["movies", id],
    queryFn: () => api.get<Movie>(`/movies/${id}`),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useDeleteMovie() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (movieId: number) => api.delete(`/movies/${movieId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movies"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["history"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
      queryClient.invalidateQueries({ queryKey: ["archive"] });
    },
  });
}

export function useRestoreMovie() {
  const queryClient = useQueryClient();

  // Undo a restore by re-archiving (the inverse of restore — archive is reversible).
  const reArchive = async (movieId: number) => {
    try {
      await api.delete(`/movies/${movieId}`);
      queryClient.invalidateQueries({ queryKey: ["movies"] });
      queryClient.invalidateQueries({ queryKey: ["archive"] });
    } catch (err) {
      console.error("Failed to undo restore:", err);
      toast.error({ title: "Error", description: "Failed to undo. Please try again." });
    }
  };

  return useMutation({
    mutationFn: (movieId: number) => api.post(`/movies/${movieId}/restore`),
    onMutate: async (movieId) => {
      await queryClient.cancelQueries({ queryKey: ["archive"] });
      const previousArchive = queryClient.getQueryData<ArchiveResponse>(["archive"]);
      const removedItem = previousArchive?.movies.find((m) => m.id === movieId);
      if (previousArchive) {
        queryClient.setQueryData<ArchiveResponse>(["archive"], {
          ...previousArchive,
          movies: previousArchive.movies.filter((m) => m.id !== movieId),
        });
      }
      return { previousArchive, removedItem };
    },
    onError: (error, _movieId, context) => {
      if (context?.previousArchive) {
        queryClient.setQueryData<ArchiveResponse>(["archive"], context.previousArchive);
      }
      console.error("Failed to restore from archive:", error);
      toast.error({ title: "Error", description: "Failed to restore. Please try again." });
    },
    onSuccess: (_data, movieId, context) => {
      toast.success({
        title: "Restored to library",
        description: `"${context?.removedItem?.title ?? "Item"}" has been restored to your library.`,
        action: React.createElement(
          ToastAction,
          { altText: "Undo restore", onClick: () => reArchive(movieId) },
          "Undo",
        ),
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["movies"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["history"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
      queryClient.invalidateQueries({ queryKey: ["archive"] });
    },
  });
}
