"use client";

import { useState, useEffect, useMemo, memo, useCallback } from "react";
import { useTrends } from "@/hooks/useStats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChartCard } from "@/components/ui/chart-card";
import { Calendar, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, subDays, differenceInDays } from "date-fns";
import { RECHARTS_TOOLTIP_STYLE } from "@/lib/utils";

interface TrendItem {
  snapshot_date: string;
  total_watch_time_minutes: number;
  delta_watch_time_minutes?: number;
  shows_watched: number;
  shows_watching: number;
  episodes_watched: number;
  delta_episodes_watched?: number;
}

const RANGE_OPTIONS = [7, 30, 90, 365] as const;

const ComparisonView = memo(function ComparisonView({
  chartData,
  comparisonTrends,
}: {
  chartData: Record<string, unknown>[];
  comparisonTrends: TrendItem[];
}) {
  const currentAvg =
    chartData.length > 0
      ? chartData.reduce((sum, d) => sum + ((d.watchTime as number) || 0), 0) / chartData.length
      : 0;

  const lastYearData = comparisonTrends.map((item) => ({
    watchTime: parseFloat(
      ((item.delta_watch_time_minutes ?? item.total_watch_time_minutes) / 60).toFixed(1),
    ),
    showsWatched: item.shows_watched,
  }));

  const lastYearAvg =
    lastYearData.length > 0
      ? lastYearData.reduce((sum, d) => sum + d.watchTime, 0) / lastYearData.length
      : 0;

  const watchTimeChange = lastYearAvg > 0 ? ((currentAvg - lastYearAvg) / lastYearAvg) * 100 : 0;

  const currentShowsAvg =
    chartData.length > 0
      ? chartData.reduce((sum, d) => sum + ((d.showsWatched as number) || 0), 0) / chartData.length
      : 0;

  const lastYearShowsAvg =
    lastYearData.length > 0
      ? lastYearData.reduce((sum, d) => sum + d.showsWatched, 0) / lastYearData.length
      : 0;

  const showsChange =
    lastYearShowsAvg > 0 ? ((currentShowsAvg - lastYearShowsAvg) / lastYearShowsAvg) * 100 : 0;

  return (
    <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="rounded-xl border border-white/8 bg-white/3 p-3">
        <p className="text-[11px] uppercase tracking-[0.12em] text-white/40 mb-1.5">
          Watch Time Change
        </p>
        <p
          className={`text-xl font-bold tabular-nums ${watchTimeChange >= 0 ? "text-emerald-400" : "text-red-400"}`}
        >
          {watchTimeChange >= 0 ? "+" : ""}
          {watchTimeChange.toFixed(1)}%
        </p>
      </div>
      <div className="rounded-xl border border-white/8 bg-white/3 p-3">
        <p className="text-[11px] uppercase tracking-[0.12em] text-white/40 mb-1.5">
          Shows Watched Change
        </p>
        <p
          className={`text-xl font-bold tabular-nums ${showsChange >= 0 ? "text-emerald-400" : "text-red-400"}`}
        >
          {showsChange >= 0 ? "+" : ""}
          {showsChange.toFixed(1)}%
        </p>
      </div>
      <div className="rounded-xl border border-white/8 bg-white/3 p-3">
        <p className="text-[11px] uppercase tracking-[0.12em] text-white/40 mb-1.5">
          Current Avg (h/day)
        </p>
        <p className="text-xl font-bold text-white tabular-nums">{currentAvg.toFixed(1)}</p>
      </div>
      <div className="rounded-xl border border-white/8 bg-white/3 p-3">
        <p className="text-[11px] uppercase tracking-[0.12em] text-white/40 mb-1.5">
          Last Year Avg (h/day)
        </p>
        <p className="text-xl font-bold text-white tabular-nums">{lastYearAvg.toFixed(1)}</p>
      </div>
    </div>
  );
});

export function TrendsChart() {
  const [daysRange, setDaysRange] = useState<number | "custom">(30);
  const [customStartDate, setCustomStartDate] = useState<string>(
    format(subDays(new Date(), 30), "yyyy-MM-dd"),
  );
  const [customEndDate, setCustomEndDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const check = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsMobile(window.innerWidth < 768);
      }, 150);
    };
    window.addEventListener("resize", check);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", check);
    };
  }, []);

  const customDays =
    daysRange === "custom"
      ? differenceInDays(new Date(customEndDate), new Date(customStartDate)) + 1
      : daysRange;

  const effectiveDays = typeof customDays === "number" && customDays > 0 ? customDays : 30;

  const { data: trends, isLoading } = useTrends(effectiveDays, "daily");
  const { data: comparisonTrends } = useTrends(effectiveDays, "daily");

  const chartData = useMemo(() => {
    if (!trends || !Array.isArray(trends)) return [];
    return (trends as TrendItem[]).map((item, index) => {
      const watchMinutes = item.delta_watch_time_minutes ?? item.total_watch_time_minutes;
      const dataPoint: Record<string, unknown> = {
        date: format(new Date(item.snapshot_date), "MMM dd"),
        watchTime: parseFloat((watchMinutes / 60).toFixed(1)),
        showsWatched: item.shows_watched,
        showsWatching: item.shows_watching,
        episodesWatched: item.delta_episodes_watched ?? item.episodes_watched,
      };
      if (showComparison && comparisonTrends && Array.isArray(comparisonTrends)) {
        const comparisonItem = (comparisonTrends as TrendItem[])[index];
        if (comparisonItem) {
          const compMinutes =
            comparisonItem.delta_watch_time_minutes ?? comparisonItem.total_watch_time_minutes;
          dataPoint.watchTimeLastYear = parseFloat((compMinutes / 60).toFixed(1));
          dataPoint.showsWatchedLastYear = comparisonItem.shows_watched;
        }
      }
      return dataPoint;
    });
  }, [trends, showComparison, comparisonTrends]);

  const handleRangeSelect = useCallback((days: number) => {
    setDaysRange(days);
    setShowCustomPicker(false);
  }, []);

  const handleApplyCustom = useCallback(() => {
    if (customDays > 0 && customDays <= 365) {
      setShowCustomPicker(false);
    }
  }, [customDays]);

  return (
    <ChartCard
      title="Trends Over Time"
      icon={<TrendingUp className="h-5 w-5 text-purple-400" />}
      isLoading={isLoading}
      minHeight="min-h-[400px]"
      isEmpty={chartData.length === 0 && !isLoading}
      emptyMessage="No trend data yet"
      emptyDescription="Watch some content to start seeing trends"
      emptyIcon={<TrendingUp className="h-10 w-10" />}
      titleExtra={
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowComparison(!showComparison)}
          className={showComparison ? "bg-purple-500/20 border-purple-500/30" : ""}
        >
          {showComparison ? "Hide" : "Show"} Comparison
        </Button>
      }
    >
      <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 mb-5">
        {RANGE_OPTIONS.map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => handleRangeSelect(days)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
              daysRange === days
                ? "bg-purple-500/30 text-purple-100 shadow-sm shadow-purple-500/20 border border-purple-500/30"
                : "text-white/50 hover:text-white/80 border border-white/10 bg-white/5"
            }`}
          >
            {days}d
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCustomPicker(!showCustomPicker)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 flex items-center gap-1 ${
            daysRange === "custom"
              ? "bg-purple-500/30 text-purple-100 shadow-sm shadow-purple-500/20 border border-purple-500/30"
              : "text-white/50 hover:text-white/80 border border-white/10 bg-white/5"
          }`}
        >
          <Calendar className="h-3 w-3" />
          Custom
        </button>
      </div>

      {showCustomPicker && (
        <div className="mb-5 p-4 rounded-xl bg-white/3 border border-white/8 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date" className="text-sm font-medium text-white/60">
                Start Date
              </Label>
              <Input
                id="start-date"
                type="date"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  setDaysRange("custom");
                }}
                max={customEndDate}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date" className="text-sm font-medium text-white/60">
                End Date
              </Label>
              <Input
                id="end-date"
                type="date"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  setDaysRange("custom");
                }}
                min={customStartDate}
                max={format(new Date(), "yyyy-MM-dd")}
                className="h-10"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/40">
              {customDays > 0 ? `${customDays} days selected` : "Invalid date range"}
            </p>
            <Button
              size="sm"
              onClick={handleApplyCustom}
              disabled={customDays <= 0 || customDays > 365}
            >
              Apply
            </Button>
          </div>
        </div>
      )}

      {daysRange === "custom" && !showCustomPicker && (
        <div className="mb-5 text-sm text-white/40">
          Showing data from {format(new Date(customStartDate), "MMM dd, yyyy")} to{" "}
          {format(new Date(customEndDate), "MMM dd, yyyy")} ({customDays} days)
        </div>
      )}

      {chartData.length > 0 && (
        <div className="h-[260px] sm:h-[340px] md:h-[420px] w-full [&>div]:h-full!">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={
                isMobile
                  ? { top: 8, right: 4, left: 0, bottom: 0 }
                  : { top: 10, right: 20, left: 10, bottom: 10 }
              }
            >
              <defs>
                <linearGradient id="trendsPurpleGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
                <linearGradient id="trendsBlueGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#60a5fa" />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                stroke="rgba(255,255,255,0.4)"
                fontSize={isMobile ? 10 : 12}
                tickLine={false}
                axisLine={false}
                tickMargin={isMobile ? 4 : 8}
                interval={isMobile ? "preserveStartEnd" : 0}
              />
              <YAxis
                stroke="rgba(255,255,255,0.4)"
                fontSize={isMobile ? 10 : 12}
                tickLine={false}
                axisLine={false}
                tickMargin={isMobile ? 4 : 8}
                width={isMobile ? 28 : 40}
              />
              <Tooltip
                contentStyle={RECHARTS_TOOLTIP_STYLE.contentStyle}
                labelStyle={RECHARTS_TOOLTIP_STYLE.labelStyle}
                itemStyle={RECHARTS_TOOLTIP_STYLE.itemStyle}
              />
              <Legend
                wrapperStyle={{
                  paddingTop: isMobile ? "12px" : "20px",
                  fontSize: isMobile ? "11px" : "13px",
                }}
                iconType="line"
                iconSize={isMobile ? 8 : 14}
              />
              <Line
                type="monotone"
                dataKey="watchTime"
                stroke="url(#trendsPurpleGradient)"
                name="Watch Time (h)"
                strokeWidth={isMobile ? 2 : 3}
                dot={{ fill: "#a855f7", r: isMobile ? 2 : 4, strokeWidth: 0 }}
                activeDot={{
                  r: isMobile ? 4 : 6,
                  fill: "#a855f7",
                  stroke: "rgba(168, 85, 247, 0.3)",
                  strokeWidth: isMobile ? 6 : 8,
                }}
              />
              <Line
                type="monotone"
                dataKey="showsWatched"
                stroke="url(#trendsBlueGradient)"
                name="Shows Watched"
                strokeWidth={isMobile ? 2 : 3}
                dot={{ fill: "#3b82f6", r: isMobile ? 2 : 4, strokeWidth: 0 }}
                activeDot={{
                  r: isMobile ? 4 : 6,
                  fill: "#3b82f6",
                  stroke: "rgba(59, 130, 246, 0.3)",
                  strokeWidth: isMobile ? 6 : 8,
                }}
              />
              {showComparison && comparisonTrends && Array.isArray(comparisonTrends) ? (
                <>
                  <Line
                    type="monotone"
                    dataKey="watchTimeLastYear"
                    stroke="rgba(255,255,255,0.3)"
                    name="Watch Time Last Year (h)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: "rgba(255,255,255,0.3)", r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "rgba(255,255,255,0.5)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="showsWatchedLastYear"
                    stroke="rgba(255,255,255,0.2)"
                    name="Shows Watched Last Year"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: "rgba(255,255,255,0.2)", r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "rgba(255,255,255,0.4)" }}
                  />
                </>
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {showComparison &&
      chartData.length > 0 &&
      comparisonTrends &&
      Array.isArray(comparisonTrends) ? (
        <ComparisonView chartData={chartData} comparisonTrends={comparisonTrends as TrendItem[]} />
      ) : null}
    </ChartCard>
  );
}
