"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
  iconColor: string;
  delta?: Delta;
}

function StatCard({ title, value, icon, iconColor, delta }: StatCardProps) {
  return (
    <Card className="hover:bg-white/6 hover:border-white/12 transition-all h-full flex flex-col py-4 sm:py-5 gap-0">
      <CardContent className="p-3 sm:p-5 flex-1 flex justify-start items-center min-h-0">
        <div className="grid grid-cols-[auto_1fr] items-center gap-3 sm:gap-4 text-left w-full">
          <div className={`p-2.5 sm:p-3 rounded-xl flex items-center justify-center ${iconColor}`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0 flex flex-col text-left mt-2.5">
            <p className="text-xs sm:text-sm font-medium text-white/50 mb-1">{title}</p>
            <p className="text-lg sm:text-2xl font-bold text-white tabular-nums leading-tight">
              {value}
            </p>
            {delta ? (
              <div
                className={`flex items-center gap-1 mt-1.5 text-[10px] sm:text-xs font-medium ${delta.positive ? "text-emerald-400" : "text-red-400"}`}
              >
                {delta.positive ? (
                  <TrendingUp className="h-2.5 w-2.5 shrink-0" />
                ) : (
                  <TrendingDown className="h-2.5 w-2.5 shrink-0" />
                )}
                <span className="truncate">
                  {delta.positive ? "+" : ""}
                  {delta.value} vs 7d
                </span>
              </div>
            ) : (
              <div className="h-4 sm:h-5" aria-hidden />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
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
      <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-white/8 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 bg-white/8 rounded-xl animate-pulse" />
                  <div className="h-6 w-16 bg-white/8 rounded-xl animate-pulse" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4 relative items-stretch">
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
        iconColor="bg-purple-500/20 border border-purple-500/30"
        delta={watchTimeDelta}
      />
      <StatCard
        title="Shows Watched"
        value={data.shows_watched}
        icon={<CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />}
        iconColor="bg-emerald-500/20 border border-emerald-500/30"
      />
      <StatCard
        title="Currently Watching"
        value={data.shows_watching}
        icon={<PlayCircle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />}
        iconColor="bg-blue-500/20 border border-blue-500/30"
        delta={episodesDelta}
      />
      <StatCard
        title="Pending"
        value={data.shows_pending}
        icon={<Clock3 className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />}
        iconColor="bg-amber-500/20 border border-amber-500/30"
      />
    </div>
  );
}
