"use client";

import { useMemo } from "react";
import { useWatchPatterns } from "@/hooks/useStats";
import { formatRuntime } from "@/lib/utils";
import { BarChart3, Clock } from "lucide-react";
import { ChartCard } from "@/components/ui/chart-card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? "12a" : i < 12 ? `${i}a` : i === 12 ? "12p" : `${i - 12}p`,
);

function PatternTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[rgba(16,16,24,0.96)] px-4 py-3 shadow-xl shadow-black/50 backdrop-blur-sm">
      <p className="text-xs font-medium text-white/55 mb-1.5">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="tabular-nums text-sm font-bold text-white">{payload[0].value}</span>
        <span className="text-[11px] text-white/40">sessions</span>
      </div>
    </div>
  );
}

export function WatchPatternHeatmap() {
  const { data, isLoading } = useWatchPatterns(90);

  const heatmapData = useMemo(() => {
    if (!data?.by_hour || !data?.by_day_of_week) return null;
    const byHour = data.by_hour as Record<string, number>;
    const byDow = data.by_day_of_week as Record<string, number>;
    const maxHour = Math.max(1, ...Object.values(byHour));
    const maxDow = Math.max(1, ...Object.values(byDow));

    return {
      byHour: Object.entries(byHour)
        .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
        .map(([h, v]) => ({
          hour: HOUR_LABELS[parseInt(h, 10)],
          count: v,
          intensity: maxHour > 0 ? v / maxHour : 0,
        })),
      byDow: Object.entries(byDow)
        .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
        .map(([d, v]) => ({
          day: DAY_LABELS[parseInt(d, 10)],
          count: v,
          intensity: maxDow > 0 ? v / maxDow : 0,
        })),
    };
  }, [data]);

  const isEmpty =
    !heatmapData || (!data?.avg_session_minutes && heatmapData.byHour.every((r) => r.count === 0));

  const avgSession = data?.avg_session_minutes ?? 0;

  return (
    <ChartCard
      title="Watch Patterns"
      icon={<BarChart3 className="h-5 w-5 text-purple-400" />}
      isLoading={isLoading}
      minHeight="min-h-[260px]"
      isEmpty={isEmpty}
      emptyMessage="No watch pattern data yet"
      emptyDescription="Watch more content to see your patterns"
      emptyIcon={<BarChart3 className="h-10 w-10" />}
      titleExtra={
        avgSession > 0 ? (
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/60">
            <Clock className="h-3 w-3" />
            Avg session: {formatRuntime(Math.round(avgSession)) ?? "0m"}
          </span>
        ) : null
      }
    >
      {heatmapData && (
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-white/40 mb-3">
              By Hour of Day
            </p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={heatmapData.byHour}
                  margin={{ top: 4, right: 4, left: -12, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="hour"
                    tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval={2}
                  />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={(props) => (
                      <PatternTooltip
                        active={props.active}
                        payload={props.payload as Array<{ value: number }>}
                        label={props.label as string}
                      />
                    )}
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={14}>
                    {heatmapData.byHour.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={`rgba(168, 85, 247, ${0.25 + entry.intensity * 0.75})`}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-white/40 mb-3">
              By Day of Week
            </p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={heatmapData.byDow}
                  margin={{ top: 4, right: 4, left: -12, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={(props) => (
                      <PatternTooltip
                        active={props.active}
                        payload={props.payload as Array<{ value: number }>}
                        label={props.label as string}
                      />
                    )}
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={20}>
                    {heatmapData.byDow.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={`rgba(168, 85, 247, ${0.25 + entry.intensity * 0.75})`}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </ChartCard>
  );
}
