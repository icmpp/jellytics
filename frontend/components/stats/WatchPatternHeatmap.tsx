"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWatchPatterns } from "@/hooks/useStats";
import { formatRuntime } from "@/lib/utils";
import { BarChart3 } from "lucide-react";
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-400" />
            Watch Patterns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 rounded-xl bg-white/[0.03] animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (!heatmapData || (!data?.avg_session_minutes && heatmapData.byHour.every((r) => r.count === 0))) {
    return null;
  }

  const avgSession = data?.avg_session_minutes ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-purple-400" />
          Watch Patterns
          {avgSession > 0 && (
            <span className="text-sm font-normal text-white/50">
              (Avg session: {formatRuntime(Math.round(avgSession)) ?? "0m"})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-white/70 mb-3">
              By Hour of Day
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={heatmapData.byHour} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="hour"
                    tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                    interval={2}
                  />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(13,13,20,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "rgba(255,255,255,0.8)" }}
                    formatter={(value: number | undefined) => [value ?? 0, "Sessions"]}
                  />
                  <Bar dataKey="count" fill="#a855f7" radius={[2, 2, 0, 0]}>
                    {heatmapData.byHour.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={`rgba(168, 85, 247, ${0.3 + entry.intensity * 0.7})`}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-white/70 mb-3">
              By Day of Week
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={heatmapData.byDow} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                  />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(13,13,20,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number | undefined) => [value ?? 0, "Sessions"]}
                  />
                  <Bar dataKey="count" fill="#a855f7" radius={[2, 2, 0, 0]}>
                    {heatmapData.byDow.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={`rgba(168, 85, 247, ${0.3 + entry.intensity * 0.7})`}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
