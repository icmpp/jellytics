"use client";

import { useId, useMemo, useState, useCallback, type ReactNode } from "react";
import { format } from "date-fns";
import {
  Area,
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Calendar, Clock, Flame, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { useTrends } from "@/hooks/useStats";
import { ChartCard } from "@/components/ui/chart-card";

interface TrendItem {
  snapshot_date: string;
  total_watch_time_minutes: number;
  delta_watch_time_minutes?: number;
}

interface ChartPoint {
  date: string;
  fullDate: string;
  watchTime: number;
  rollingAvg: number;
}

const RANGE_OPTIONS = [
  { label: "14d", value: 14 },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
] as const;

function StatCard({
  icon,
  label,
  value,
  unit,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  unit: string;
  sub?: string;
}) {
  return (
    <div className="group rounded-xl border border-white/8 bg-white/3 p-3 transition-colors duration-200 hover:border-white/12 hover:bg-white/5">
      <div className="mb-1.5 flex items-center gap-1.5">
        {icon}
        <p className="text-[11px] uppercase tracking-[0.12em] text-white/40">{label}</p>
      </div>
      <p className="tabular-nums text-lg font-bold text-white">
        {value}
        <span className="text-sm font-normal text-white/45">{unit}</span>
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-white/30">{sub}</p>}
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  showRollingAvg,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
  label?: string;
  showRollingAvg: boolean;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-xl border border-white/10 bg-[rgba(16,16,24,0.96)] px-4 py-3 shadow-xl shadow-black/50 backdrop-blur-sm">
      <p className="mb-2 text-xs font-medium text-white/55">{point.fullDate}</p>
      <div className="flex items-baseline gap-2">
        <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-purple-400" />
        <span className="tabular-nums text-sm font-semibold text-white">
          {point.watchTime.toFixed(1)}h
        </span>
        <span className="text-[11px] text-white/40">watched</span>
      </div>
      {showRollingAvg && (
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-cyan-400/70" />
          <span className="tabular-nums text-sm font-medium text-white/75">
            {point.rollingAvg.toFixed(1)}h
          </span>
          <span className="text-[11px] text-white/40">7-day avg</span>
        </div>
      )}
    </div>
  );
}

export function WatchTimeChart() {
  const [days, setDays] = useState(30);
  const [showRollingAvg, setShowRollingAvg] = useState(true);
  const gradientId = useId().replace(/:/g, "");
  const areaGradientId = `${gradientId}-area`;
  const lineGradientId = `${gradientId}-line`;
  const { data, isLoading } = useTrends(days, "daily");

  const chartData = useMemo(() => {
    if (!Array.isArray(data)) return [];

    return data.map((item: TrendItem, index: number, arr: TrendItem[]) => {
      const minutes = item.delta_watch_time_minutes ?? item.total_watch_time_minutes;
      const watchTime = parseFloat((minutes / 60).toFixed(1));
      const windowStart = Math.max(0, index - 6);
      const rollingWindow = arr.slice(windowStart, index + 1);
      const rollingAvg =
        rollingWindow.reduce((sum, pt) => {
          const m = pt.delta_watch_time_minutes ?? pt.total_watch_time_minutes;
          return sum + m / 60;
        }, 0) / rollingWindow.length;

      return {
        date: format(new Date(item.snapshot_date), "MMM d"),
        fullDate: format(new Date(item.snapshot_date), "EEE, MMM d"),
        watchTime,
        rollingAvg: parseFloat(rollingAvg.toFixed(2)),
      } satisfies ChartPoint;
    });
  }, [data]);

  const totalHours = useMemo(
    () => chartData.reduce((sum, item) => sum + item.watchTime, 0),
    [chartData],
  );
  const avgHours = chartData.length > 0 ? totalHours / chartData.length : 0;

  const peakDay = useMemo(() => {
    if (chartData.length === 0) return { hours: 0, date: "" };
    const max = chartData.reduce((best, item) => (item.watchTime > best.watchTime ? item : best));
    return { hours: max.watchTime, date: max.date };
  }, [chartData]);

  const streak = useMemo(() => {
    if (chartData.length === 0) return 0;
    let count = 0;
    for (let i = chartData.length - 1; i >= 0; i--) {
      if (chartData[i].watchTime > 0) count++;
      else break;
    }
    return count;
  }, [chartData]);

  const weekTrend = useMemo(() => {
    if (chartData.length < 14) return null;
    const recentWeek = chartData.slice(-7);
    const prevWeek = chartData.slice(-14, -7);
    const recentSum = recentWeek.reduce((s, i) => s + i.watchTime, 0);
    const prevSum = prevWeek.reduce((s, i) => s + i.watchTime, 0);
    if (prevSum === 0) return null;
    const pct = ((recentSum - prevSum) / prevSum) * 100;
    return { pct: Math.round(pct), up: pct >= 0 };
  }, [chartData]);

  const activeDays = useMemo(() => chartData.filter((d) => d.watchTime > 0).length, [chartData]);
  const consistencyPct =
    chartData.length > 0 ? Math.round((activeDays / chartData.length) * 100) : 0;
  const maxHours = useMemo(() => Math.max(...chartData.map((p) => p.watchTime), 0), [chartData]);

  const showPeakRef = maxHours > 0 && maxHours > avgHours * 1.2;

  const tooltipContent = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (props: any) => <ChartTooltip {...props} showRollingAvg={showRollingAvg} />,
    [showRollingAvg],
  );

  return (
    <ChartCard
      title="Watch Time Trend"
      icon={<TrendingUp className="h-5 w-5 text-purple-400" />}
      isLoading={isLoading}
      minHeight="min-h-[350px]"
      isEmpty={chartData.length === 0}
      emptyMessage="No trend data yet"
      emptyDescription="Watch some content to see your daily watch time trend"
      emptyIcon={<TrendingUp className="h-10 w-10" />}
      className="h-full"
      titleExtra={
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDays(option.value)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-200 ${
                  days === option.value
                    ? "bg-purple-500/30 text-purple-100 shadow-sm shadow-purple-500/20"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {!isLoading && chartData.length > 0 && (
            <span className="hidden rounded-full border border-purple-400/20 bg-purple-500/10 px-2.5 py-1 text-xs tabular-nums text-purple-200 sm:inline-flex">
              {totalHours.toFixed(1)}h total
            </span>
          )}
          {weekTrend && (
            <span
              className={`hidden items-center gap-1 rounded-full border px-2 py-1 text-xs tabular-nums sm:inline-flex ${
                weekTrend.up
                  ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
                  : "border-red-400/20 bg-red-500/10 text-red-300"
              }`}
            >
              {weekTrend.up ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {weekTrend.up ? "+" : ""}
              {weekTrend.pct}% vs prev week
            </span>
          )}
        </div>
      }
    >
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard
          icon={<Clock className="h-3.5 w-3.5 text-purple-400" />}
          label="Daily Avg"
          value={avgHours.toFixed(1)}
          unit="h"
        />
        <StatCard
          icon={<Zap className="h-3.5 w-3.5 text-amber-400" />}
          label="Peak Day"
          value={peakDay.hours.toFixed(1)}
          unit="h"
          sub={peakDay.date || undefined}
        />
        <StatCard
          icon={<Flame className="h-3.5 w-3.5 text-orange-400" />}
          label="Streak"
          value={`${streak}`}
          unit=" days"
        />
        <StatCard
          icon={<Calendar className="h-3.5 w-3.5 text-cyan-400" />}
          label="Consistency"
          value={`${consistencyPct}`}
          unit="%"
          sub={`${activeDays}/${chartData.length} active days`}
        />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {avgHours > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-white/35">
              <span className="inline-block w-3 border-t border-dashed border-purple-300/40" />
              avg
            </div>
          )}
          {showPeakRef && (
            <div className="flex items-center gap-1.5 text-[11px] text-white/35">
              <span className="inline-block w-3 border-t border-dashed border-amber-400/40" />
              peak
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowRollingAvg((prev) => !prev)}
          className={`rounded-full border px-2.5 py-1 text-xs transition-all duration-200 ${
            showRollingAvg
              ? "border-cyan-400/25 bg-cyan-400/10 text-cyan-200"
              : "border-white/10 bg-white/5 text-white/50 hover:text-white/80"
          }`}
        >
          7-day smoothing
        </button>
      </div>

      <div className="min-h-[230px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{
              top: 8,
              right: 16,
              left: 0,
              bottom: days > 30 ? 28 : 8,
            }}
          >
            <defs>
              <linearGradient id={lineGradientId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#a855f7" />
                <stop offset="50%" stopColor="#c084fc" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
              <linearGradient id={areaGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(168,85,247,0.28)" />
                <stop offset="60%" stopColor="rgba(168,85,247,0.06)" />
                <stop offset="100%" stopColor="rgba(168,85,247,0)" />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="rgba(255,255,255,0.35)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              minTickGap={days > 60 ? 40 : days > 30 ? 30 : 14}
              interval="preserveStartEnd"
              dy={4}
            />
            <YAxis
              stroke="rgba(255,255,255,0.35)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={36}
              tickFormatter={(value: number) => `${value}h`}
              domain={[0, (dataMax: number) => Math.max(1, Math.ceil(dataMax * 1.15))]}
            />
            <Tooltip
              content={tooltipContent}
              cursor={{
                stroke: "rgba(255,255,255,0.12)",
                strokeWidth: 1,
                strokeDasharray: "4 4",
              }}
            />

            {avgHours > 0 && (
              <ReferenceLine
                y={Number(avgHours.toFixed(2))}
                stroke="rgba(196,181,253,0.28)"
                strokeDasharray="6 4"
                ifOverflow="extendDomain"
              />
            )}
            {showPeakRef && (
              <ReferenceLine
                y={Number(maxHours.toFixed(2))}
                stroke="rgba(245,158,11,0.18)"
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
              />
            )}

            <Area
              type="monotone"
              dataKey="watchTime"
              stroke="none"
              fill={`url(#${areaGradientId})`}
              fillOpacity={1}
              legendType="none"
              animationDuration={800}
              animationEasing="ease-out"
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="watchTime"
              stroke={`url(#${lineGradientId})`}
              strokeWidth={2.5}
              strokeLinecap="round"
              dot={false}
              activeDot={{
                r: 5,
                fill: "#a855f7",
                stroke: "rgba(168,85,247,0.25)",
                strokeWidth: 8,
              }}
              legendType="none"
              animationDuration={900}
              animationEasing="ease-out"
              connectNulls
            />
            {showRollingAvg && (
              <Line
                type="monotone"
                dataKey="rollingAvg"
                stroke="#22d3ee"
                strokeOpacity={0.55}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeDasharray="6 3"
                dot={false}
                legendType="none"
                animationDuration={1000}
                animationEasing="ease-out"
                connectNulls
              />
            )}
            {days >= 30 && (
              <Brush
                dataKey="date"
                height={18}
                stroke="rgba(168,85,247,0.30)"
                travellerWidth={7}
                fill="rgba(255,255,255,0.02)"
                tickFormatter={() => ""}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
