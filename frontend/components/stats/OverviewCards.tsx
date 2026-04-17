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
  iconBg: string;
  glowColor: string;
  delta?: Delta;
}

function StatCard({ title, value, icon, iconBg, glowColor, delta }: StatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/8 bg-white/3 backdrop-blur-xl p-4 sm:p-5 flex flex-col gap-3 hover:border-white/12 hover:bg-white/5 transition-all duration-300 min-h-[120px] sm:min-h-[130px]">
      {/* Corner glow accent */}
      <div
        className={`pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full blur-3xl opacity-15 ${glowColor}`}
      />

      {/* Top row: icon + optional delta badge */}
      <div className="relative flex items-start justify-between gap-2">
        <div className={`flex items-center justify-center p-2 sm:p-2.5 rounded-xl ${iconBg}`}>
          {icon}
        </div>
        {delta && (
          <span
            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold shrink-0 ${
              delta.positive
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
          >
            {delta.positive ? (
              <TrendingUp className="h-2.5 w-2.5 shrink-0" />
            ) : (
              <TrendingDown className="h-2.5 w-2.5 shrink-0" />
            )}
            <span>
              {delta.positive ? "+" : ""}
              {delta.value}
            </span>
          </span>
        )}
      </div>

      {/* Metric */}
      <div className="relative mt-auto">
        <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tabular-nums tracking-tight leading-none">
          {value}
        </p>
        <p className="mt-1.5 text-[10px] sm:text-xs font-medium text-white/40 tracking-widest uppercase">
          {title}
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
            className="rounded-2xl border border-white/8 bg-white/3 p-4 sm:p-5 flex flex-col gap-3 min-h-[120px] sm:min-h-[130px]"
          >
            <div className="h-9 w-9 rounded-xl bg-white/8 animate-pulse" />
            <div className="mt-auto space-y-2">
              <div className="h-7 w-20 bg-white/8 rounded-lg animate-pulse" />
              <div className="h-3 w-28 bg-white/5 rounded-lg animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 relative items-stretch">
      {isFetching && !isLoading && (
        <div className="absolute -top-2 right-0 z-10">
          <div className="h-1 w-20 bg-purple-500/20 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 animate-pulse" style={{ width: "60%" }} />
          </div>
        </div>
      )}
      <StatCard
        title="Total Watch Time"
        value={formatRuntime(data.total_watch_time_minutes) ?? "0m"}
        icon={<Clock className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400" />}
        iconBg="bg-purple-500/15 border border-purple-500/25"
        glowColor="bg-purple-500"
        delta={watchTimeDelta}
      />
      <StatCard
        title="Shows Watched"
        value={data.shows_watched}
        icon={<CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />}
        iconBg="bg-emerald-500/15 border border-emerald-500/25"
        glowColor="bg-emerald-500"
      />
      <StatCard
        title="Currently Watching"
        value={data.shows_watching}
        icon={<PlayCircle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />}
        iconBg="bg-blue-500/15 border border-blue-500/25"
        glowColor="bg-blue-500"
        delta={episodesDelta}
      />
      <StatCard
        title="Pending"
        value={data.shows_pending}
        icon={<Clock3 className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />}
        iconBg="bg-amber-500/15 border border-amber-500/25"
        glowColor="bg-amber-500"
      />
    </div>
  );
}
