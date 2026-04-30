"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

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
  return useMutation({
    mutationFn: (movieId: number) => api.post(`/movies/${movieId}/restore`),
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
