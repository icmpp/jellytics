"use client";

import { useStatsOverview, useWeeklySummary } from "@/hooks/useStats";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

function formatHours(minutes: number): string {
  const hours = Math.round(minutes / 60);
  return `${hours}h`;
}

interface TrendIndicatorProps {
  current: number;
  previous: number;
}

function TrendIndicator({ current, previous }: TrendIndicatorProps) {
  if (previous === 0) {
    return (
      <div className="flex items-center gap-1 text-[10px] sm:text-xs font-medium text-white/30">
        <Minus className="h-3 w-3 shrink-0" />
        <span>No prior data</span>
      </div>
    );
  }

  const change = ((current - previous) / previous) * 100;
  const isPositive = change > 0;

  return (
    <div
      className={`flex items-center gap-1 text-[10px] sm:text-xs font-semibold ${isPositive ? "text-emerald-400" : "text-red-400"}`}
    >
      {isPositive ? (
        <TrendingUp className="h-3 w-3 shrink-0" />
      ) : (
        <TrendingDown className="h-3 w-3 shrink-0" />
      )}
      <span>
        {isPositive ? "+" : ""}
        {Math.abs(change).toFixed(1)}% vs last week
      </span>
    </div>
  );
}

interface QuickStatCardProps {
  label: string;
  value: string | number;
  trend?: React.ReactNode;
  sub?: React.ReactNode;
}

function QuickStatCard({ label, value, trend, sub }: QuickStatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/3 backdrop-blur-xl p-4 sm:p-5 flex flex-col gap-2 hover:border-white/12 hover:bg-white/5 transition-all duration-300">
      <p className="text-[10px] sm:text-xs font-medium text-white/40 uppercase tracking-widest">
        {label}
      </p>
      <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums tracking-tight leading-none">
        {value}
      </p>
      {trend && <div className="pt-0.5">{trend}</div>}
      {sub && <div className="pt-0.5">{sub}</div>}
    </div>
  );
}

export function QuickStats() {
  const { data: overview } = useStatsOverview();
  const { data: weeklySummary } = useWeeklySummary();

  const thisWeekWatchTime = weeklySummary?.this_week.watch_time_minutes ?? 0;
  const lastWeekWatchTime = weeklySummary?.last_week.watch_time_minutes ?? 0;
  const thisWeekEpisodes = weeklySummary?.this_week.episodes_watched ?? 0;
  const lastWeekEpisodes = weeklySummary?.last_week.episodes_watched ?? 0;

  if (!overview) return null;

  const completionRate =
    overview.total_shows > 0
      ? Math.round((overview.shows_watched / overview.total_shows) * 100)
      : 0;

  return (
    <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
      <QuickStatCard
        label="This Week"
        value={formatHours(thisWeekWatchTime)}
        trend={<TrendIndicator current={thisWeekWatchTime} previous={lastWeekWatchTime} />}
      />
      <QuickStatCard
        label="Episodes Watched"
        value={thisWeekEpisodes}
        trend={<TrendIndicator current={thisWeekEpisodes} previous={lastWeekEpisodes} />}
      />
      <QuickStatCard
        label="Completion Rate"
        value={`${completionRate}%`}
        sub={
          <p className="text-[10px] sm:text-xs text-white/30 font-medium">
            {overview.shows_watched} of {overview.total_shows} shows
          </p>
        }
      />
    </div>
  );
}
