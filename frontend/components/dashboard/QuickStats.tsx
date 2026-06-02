"use client";

import { useStatsOverview, useWeeklySummary } from "@/hooks/useStats";
import { TrendingUp, TrendingDown, Minus, Calendar, Tv, CheckCircle2 } from "lucide-react";

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
      <div className="flex items-center gap-1 text-[10px] font-mono text-white/35">
        <Minus className="h-3 w-3 shrink-0" />
        <span>no prior data</span>
      </div>
    );
  }

  const change = ((current - previous) / previous) * 100;
  const isPositive = change > 0;

  return (
    <div
      className={`flex items-center gap-1 text-[10px] font-mono ${isPositive ? "text-emerald-400/80" : "text-red-400/80"}`}
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
  icon: React.ReactNode;
  trend?: React.ReactNode;
  sub?: React.ReactNode;
}

function QuickStatCard({ label, value, icon, trend, sub }: QuickStatCardProps) {
  return (
    <div className="relative overflow-hidden border border-[#16162a] bg-[#07070d] flex flex-col hover:border-violet-500/25 transition-colors duration-200">
      <div className="h-0.5 w-full bg-violet-500/40 shrink-0" />
      <div className="relative p-4 sm:p-5 flex flex-col flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="shrink-0 text-violet-400/70">{icon}</span>
          <p className="text-[9px] sm:text-[10px] font-mono text-violet-300/65 uppercase tracking-[0.15em] select-none truncate">
            <span className="text-violet-400/45 mr-0.5">{'//'}</span>{label}
          </p>
        </div>
        <p className="mt-3 text-2xl sm:text-3xl font-mono font-bold text-white tabular-nums tracking-tight leading-none">
          {value}
        </p>
        <div className="mt-2 h-[18px] flex items-center">
          {trend ?? sub ?? null}
        </div>
      </div>
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
    <>
      <QuickStatCard
        label="this_week"
        icon={<Calendar className="h-4 w-4" />}
        value={formatHours(thisWeekWatchTime)}
        trend={<TrendIndicator current={thisWeekWatchTime} previous={lastWeekWatchTime} />}
      />
      <QuickStatCard
        label="episodes_watched"
        icon={<Tv className="h-4 w-4" />}
        value={thisWeekEpisodes}
        trend={<TrendIndicator current={thisWeekEpisodes} previous={lastWeekEpisodes} />}
      />
      <QuickStatCard
        label="completion_rate"
        icon={<CheckCircle2 className="h-4 w-4" />}
        value={`${completionRate}%`}
        sub={
          <p className="text-[10px] font-mono text-white/40">
            {overview.shows_watched} of {overview.total_shows} shows
          </p>
        }
      />
    </>
  );
}
