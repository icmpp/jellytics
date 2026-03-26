"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="flex items-center gap-1.5 text-sm text-white/40">
        <Minus className="h-4 w-4" />
        <span>Not enough history yet</span>
      </div>
    );
  }

  const change = ((current - previous) / previous) * 100;
  const isPositive = change > 0;

  return (
    <div
      className={`flex items-center gap-1.5 text-sm ${isPositive ? "text-emerald-400" : "text-red-400"}`}
    >
      {isPositive ? (
        <TrendingUp className="h-4 w-4" />
      ) : (
        <TrendingDown className="h-4 w-4" />
      )}
      <span>{Math.abs(change).toFixed(1)}% vs last week</span>
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

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-white/50">
            This Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-white mb-2">
            {formatHours(thisWeekWatchTime)}
          </div>
          <TrendIndicator
            current={thisWeekWatchTime}
            previous={lastWeekWatchTime}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-white/50">
            Episodes Watched
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-white mb-2">
            {thisWeekEpisodes}
          </div>
          <TrendIndicator
            current={thisWeekEpisodes}
            previous={lastWeekEpisodes}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-white/50">
            Completion Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-white mb-2">
            {overview.total_shows > 0
              ? Math.round(
                  (overview.shows_watched / overview.total_shows) * 100,
                )
              : 0}
            %
          </div>
          <p className="text-sm text-white/40">
            {overview.shows_watched} of {overview.total_shows} shows
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
