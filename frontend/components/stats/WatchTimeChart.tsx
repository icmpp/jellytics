"use client";

import { useMemo } from "react";
import { useTrends } from "@/hooks/useStats";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { TrendingUp } from "lucide-react";
import { RECHARTS_TOOLTIP_STYLE } from "@/lib/utils";
import { ChartCard } from "@/components/ui/chart-card";

interface TrendItem {
  snapshot_date: string;
  total_watch_time_minutes: number;
  delta_watch_time_minutes?: number;
}

export function WatchTimeChart() {
  const { data, isLoading } = useTrends(30, "daily");

  const chartData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.map((item: TrendItem) => {
      const minutes =
        item.delta_watch_time_minutes ?? item.total_watch_time_minutes;
      return {
        date: format(new Date(item.snapshot_date), "MMM dd"),
        watchTime: parseFloat((minutes / 60).toFixed(1)),
      };
    });
  }, [data]);

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
        <span className="text-sm font-normal text-white/40">
          (Last 30 Days)
        </span>
      }
    >
      <ResponsiveContainer width="100%" height={350}>
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.06)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            stroke="rgba(255,255,255,0.4)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="rgba(255,255,255,0.4)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            label={{
              value: "Hours",
              angle: -90,
              position: "insideLeft",
              style: {
                fill: "rgba(255,255,255,0.4)",
                fontSize: "12px",
              },
            }}
          />
          <Tooltip
            formatter={(value: number | undefined) => [
              `${value ?? 0} hours`,
              "Watch Time",
            ]}
            contentStyle={RECHARTS_TOOLTIP_STYLE.contentStyle}
            labelStyle={RECHARTS_TOOLTIP_STYLE.labelStyle}
            itemStyle={RECHARTS_TOOLTIP_STYLE.itemStyle}
          />
          <Line
            type="monotone"
            dataKey="watchTime"
            stroke="url(#purpleGradient)"
            name="Watch Time (hours)"
            strokeWidth={3}
            dot={false}
            activeDot={{
              r: 6,
              fill: "#a855f7",
              stroke: "rgba(168, 85, 247, 0.3)",
              strokeWidth: 8,
            }}
          />
          <defs>
            <linearGradient id="purpleGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
          </defs>
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
