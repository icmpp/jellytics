"use client";

import { useMemo } from "react";
import { useStatsOverview, useTrends } from "@/hooks/useStats";
import { Clock, CheckCircle2, PlayCircle, Clock3, TrendingUp, TrendingDown } from "lucide-react";
import { formatRuntime } from "@/lib/utils";

interface Delta {
  value: string;
  positive: boolean;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  accentColor: string;
  delta?: Delta;
  subLabel?: string;
}

const accentTopLine: Record<string, string> = {
  violet: "bg-violet-500/50",
  emerald: "bg-emerald-500/50",
  blue: "bg-blue-500/50",
  amber: "bg-amber-500/50",
};
const accentIconClass: Record<string, string> = {
  violet: "text-violet-400/70",
  emerald: "text-emerald-400/70",
  blue: "text-blue-400/70",
  amber: "text-amber-400/70",
};
const accentGlow: Record<string, string> = {
  violet: "from-violet-500/5",
  emerald: "from-emerald-500/5",
  blue: "from-blue-500/5",
  amber: "from-amber-500/5",
};
const accentHoverClass: Record<string, string> = {
  violet: "hover:border-violet-500/25",
  emerald: "hover:border-emerald-500/25",
  blue: "hover:border-blue-500/25",
  amber: "hover:border-amber-500/25",
};

function StatCard({ title, value, icon, accentColor, delta, subLabel }: StatCardProps) {
  return (
    <div
      className={`group relative overflow-hidden border border-[#16162a] bg-[#07070d] flex flex-col ${accentHoverClass[accentColor]} transition-colors duration-200`}
    >
      {/* 2px accent top line */}
      <div className={`h-0.5 w-full shrink-0 ${accentTopLine[accentColor]}`} />

      {/* Subtle colour wash behind value */}
      <div className={`absolute inset-x-0 top-0 h-24 bg-linear-to-b ${accentGlow[accentColor]} to-transparent pointer-events-none`} />

      <div className="relative p-4 sm:p-5 flex flex-col flex-1">
        {/* Label row: icon + // title + delta */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`shrink-0 ${accentIconClass[accentColor]}`}>{icon}</span>
            <p className="text-[9px] sm:text-[10px] font-mono text-violet-300/65 tracking-[0.15em] uppercase select-none truncate">
              <span className="text-violet-400/45 mr-0.5">{'//'}</span>{title}
            </p>
          </div>
          {delta && (
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono shrink-0 ${
                delta.positive
                  ? "bg-emerald-500/8 text-emerald-400/80 border border-emerald-500/15"
                  : "bg-red-500/8 text-red-400/80 border border-red-500/15"
              }`}
            >
              {delta.positive ? (
                <TrendingUp className="h-2.5 w-2.5 shrink-0" />
              ) : (
                <TrendingDown className="h-2.5 w-2.5 shrink-0" />
              )}
              {delta.positive ? "+" : ""}
              {delta.value}
            </span>
          )}
        </div>

        {/* Value */}
        <p className="mt-3 text-2xl sm:text-3xl font-mono font-bold text-white tabular-nums tracking-tight leading-none">
          {value}
        </p>

        {/* Sublabel — always rendered to keep cards the same height */}
        <p className={`mt-2 text-[10px] font-mono truncate ${subLabel ? "text-white/40" : "invisible select-none"}`}>
          {subLabel ?? "·"}
        </p>
      </div>
    </div>
  );
}

interface TrendItem {
  snapshot_date: string;
  delta_watch_time_minutes?: number;
  total_watch_time_minutes: number;
  delta_episodes_watched?: number;
  episodes_watched: number;
}

function computeDeltas(trends: TrendItem[] | undefined): {
  watchTimeDelta: Delta | undefined;
  episodesDelta: Delta | undefined;
} {
  if (!trends || !Array.isArray(trends) || trends.length < 8) {
    return { watchTimeDelta: undefined, episodesDelta: undefined };
  }

  const sorted = [...trends].sort(
    (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime(),
  );

  const recent = sorted.slice(-7);
  const prior = sorted.slice(-14, -7);

  if (recent.length === 0 || prior.length === 0) {
    return { watchTimeDelta: undefined, episodesDelta: undefined };
  }

  const sumWt = (arr: TrendItem[]) =>
    arr.reduce((s, d) => s + (d.delta_watch_time_minutes ?? 0), 0);
  const sumEp = (arr: TrendItem[]) => arr.reduce((s, d) => s + (d.delta_episodes_watched ?? 0), 0);

  const recentWt = sumWt(recent);
  const priorWt = sumWt(prior);
  const wtDiff = recentWt - priorWt;

  const recentEp = sumEp(recent);
  const priorEp = sumEp(prior);
  const epDiff = recentEp - priorEp;

  return {
    watchTimeDelta:
      priorWt > 0
        ? {
            value: formatRuntime(Math.abs(wtDiff)) ?? "0m",
            positive: wtDiff >= 0,
          }
        : undefined,
    episodesDelta:
      priorEp > 0 ? { value: Math.abs(epDiff).toString(), positive: epDiff >= 0 } : undefined,
  };
}

function buildSubLabel(
  showsCount: number,
  moviesCount: number,
  showsLabel = "show",
  moviesLabel = "movie",
): string | undefined {
  const parts: string[] = [];
  if (showsCount > 0) parts.push(`${showsCount} ${showsLabel}${showsCount !== 1 ? "s" : ""}`);
  if (moviesCount > 0) parts.push(`${moviesCount} ${moviesLabel}${moviesCount !== 1 ? "s" : ""}`);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

export function OverviewCards() {
  const { data, isLoading, isFetching } = useStatsOverview();
  const { data: trends } = useTrends(14, "daily");

  const { watchTimeDelta, episodesDelta } = useMemo(
    () => computeDeltas(trends as TrendItem[] | undefined),
    [trends],
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="border border-[#16162a] bg-[#07070d] flex flex-col overflow-hidden"
          >
            <div className="h-0.5 w-full bg-violet-500/20" />
            <div className="p-4 sm:p-5 flex flex-col gap-0">
              <div className="flex items-center gap-1.5">
                <div className="h-4 w-4 rounded-sm bg-white/5 animate-pulse shrink-0" />
                <div className="h-2 w-20 bg-white/3 rounded-sm animate-pulse" />
              </div>
              <div className="mt-3 h-7 w-24 bg-white/5 rounded-sm animate-pulse" />
              <div className="mt-2 h-2 w-16 bg-white/3 rounded-sm animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const totalCompleted = (data.shows_watched ?? 0) + (data.movies_watched ?? 0);
  const totalWatching = (data.shows_watching ?? 0) + (data.movies_watching ?? 0);
  const totalPending = (data.shows_pending ?? 0) + (data.movies_pending ?? 0);

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 relative items-stretch">
      {isFetching && !isLoading && (
        <div className="absolute -top-2 right-0 z-10">
          <div className="h-0.5 w-16 bg-violet-500/20 rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 animate-pulse" style={{ width: "60%" }} />
          </div>
        </div>
      )}
      <StatCard
        title="total_watch_time"
        value={formatRuntime(data.total_watch_time_minutes) ?? "0m"}
        icon={<Clock className="h-4 w-4 text-violet-400" />}
        accentColor="violet"
        delta={watchTimeDelta}
      />
      <StatCard
        title="completed"
        value={totalCompleted}
        icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
        accentColor="emerald"
        subLabel={buildSubLabel(data.shows_watched ?? 0, data.movies_watched ?? 0)}
      />
      <StatCard
        title="watching"
        value={totalWatching}
        icon={<PlayCircle className="h-4 w-4 text-blue-400" />}
        accentColor="blue"
        delta={episodesDelta}
        subLabel={buildSubLabel(data.shows_watching ?? 0, data.movies_watching ?? 0)}
      />
      <StatCard
        title="pending"
        value={totalPending}
        icon={<Clock3 className="h-4 w-4 text-amber-400" />}
        accentColor="amber"
        subLabel={buildSubLabel(data.shows_pending ?? 0, data.movies_pending ?? 0)}
      />
    </div>
  );
}
