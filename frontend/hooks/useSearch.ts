"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";

export interface SearchShow {
  id: number;
  jellyfin_id: string;
  title: string;
  year?: number;
  status: string;
}

export interface SearchMovie {
  id: number;
  jellyfin_id: string;
  title: string;
  year?: number;
  status: string;
}

export interface SearchEpisode {
  id: number;
  show_id: number;
  show_jellyfin_id: string;
  show_title: string;
  title: string;
  season_number: number;
  episode_number: number;
  watched: boolean;
}

export interface SearchResult {
  shows: SearchShow[];
  movies: SearchMovie[];
  episodes: SearchEpisode[];
}

export function useSearch(query: string) {
  const debouncedQuery = useDebounce(query, 300);

  return useQuery<SearchResult>({
    queryKey: ["search", debouncedQuery],
    queryFn: () => api.get<SearchResult>(`/search?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
