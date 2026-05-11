"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface StatsOverview {
  total_watch_time_minutes: number;
  shows_watched: number;
  shows_watching: number;
  shows_pending: number;
  movies_watched: number;
  movies_watching: number;
  movies_pending: number;
  episodes_watched: number;
  total_shows: number;
  total_movies: number;
}

interface GenreBreakdown {
  [genre: string]: number;
}

export function useStatsOverview() {
  return useQuery<StatsOverview>({
    queryKey: ["stats", "overview"],
    queryFn: () => api.get<StatsOverview>("/stats/overview"),
    staleTime: 5 * 60 * 1000, // Data from DB, updated by sync
    gcTime: 10 * 60 * 1000,
  });
}

export function useGenreBreakdown() {
  return useQuery<GenreBreakdown>({
    queryKey: ["stats", "genres"],
    queryFn: () => api.get<GenreBreakdown>("/stats/genres"),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useTrends(days: number = 30, type: string = "daily") {
  return useQuery({
    queryKey: ["stats", "trends", days, type],
    queryFn: () => api.get(`/stats/trends?days=${days}&type=${type}`),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  achieved: boolean;
  icon: string;
}

export function useMilestones() {
  return useQuery<Milestone[]>({
    queryKey: ["stats", "milestones"],
    queryFn: () => api.get<Milestone[]>("/stats/milestones"),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export interface PeriodSummary {
  period: string;
  total_watch_minutes: number;
  episodes_watched: number;
  shows_started: number;
  shows_completed: number;
  movies_watched: number;
  top_genre?: string;
  most_watched_day?: string;
}

export function usePeriodSummary(period: "month" | "year") {
  return useQuery<PeriodSummary>({
    queryKey: ["stats", "period-summary", period],
    queryFn: () => api.get<PeriodSummary>(`/stats/period-summary?period=${period}`),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export interface YearInReviewItem {
  id: number;
  title: string;
  total_watch_time_minutes: number;
}

export interface MonthSummary {
  month: string;
  total_watch_minutes: number;
  episodes_watched: number;
  movies_watched?: number;
}

export interface YearInReview {
  year: number;
  total_watch_minutes: number;
  episodes_watched: number;
  movies_watched: number;
  top_movies: YearInReviewItem[];
  top_shows: YearInReviewItem[];
  top_genres: Record<string, number>;
  month_by_month: MonthSummary[];
}

export interface Goals {
  weekly_progress: number;
  weekly_target: number;
  monthly_progress: number;
  monthly_target: number;
  current_streak: number;
  longest_streak: number;
}

export interface WatchPatterns {
  by_hour: Record<string, number>;
  by_day_of_week: Record<string, number>;
  avg_session_minutes: number;
}

export function useWatchPatterns(days = 90) {
  return useQuery<WatchPatterns>({
    queryKey: ["stats", "watch-patterns", days],
    queryFn: () => api.get<WatchPatterns>(`/stats/watch-patterns?days=${days}`),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export interface WeeklySummary {
  this_week: { watch_time_minutes: number; episodes_watched: number; movies_watched: number };
  last_week: { watch_time_minutes: number; episodes_watched: number; movies_watched: number };
}

export function useWeeklySummary() {
  return useQuery<WeeklySummary>({
    queryKey: ["stats", "weekly-summary"],
    queryFn: () => api.get<WeeklySummary>("/stats/weekly-summary"),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useGoals() {
  return useQuery<Goals>({
    queryKey: ["stats", "goals"],
    queryFn: () => api.get<Goals>("/stats/goals"),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useYearInReview(year: number) {
  return useQuery<YearInReview>({
    queryKey: ["stats", "year-in-review", year],
    queryFn: () => api.get<YearInReview>(`/stats/year-in-review?year=${year}`),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: year > 0,
  });
}

export interface ActiveSession {
  id: number;
  jellyfin_session_id: string;
  item_id: string;
  item_type: string;
  item_name: string;
  series_id?: string;
  series_name?: string;
  episode_id?: string;
  season_number?: number;
  episode_number?: number;
  position_ticks: number;
  runtime_ticks: number;
  playback_percentage: number;
  is_paused: boolean;
  client_name: string;
  device_name: string;
  device_type: string;
  started_at: string;
  updated_at: string;
}

interface CurrentlyWatchingResponse {
  sessions: ActiveSession[];
  count: number;
}

export function useCurrentlyWatching() {
  return useQuery<CurrentlyWatchingResponse>({
    queryKey: ["sessions", "currently-watching"],
    queryFn: () => api.get<CurrentlyWatchingResponse>("/sessions/currently-watching"),
    staleTime: 0,
    gcTime: 60 * 1000,
    refetchInterval: 30 * 1000,
    refetchIntervalInBackground: false,
  });
}
