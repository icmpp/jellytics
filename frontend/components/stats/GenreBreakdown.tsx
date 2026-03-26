"use client";

import { useMemo } from "react";
import { useGenreBreakdown } from "@/hooks/useStats";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";
import { RECHARTS_TOOLTIP_STYLE } from "@/lib/utils";
import { ChartCard } from "@/components/ui/chart-card";

const COLORS = [
  "#a855f7", // Purple
  "#c084fc", // Light purple
  "#8b5cf6", // Violet
  "#7c3aed", // Dark violet
  "#6366f1", // Indigo
  "#818cf8", // Light indigo
  "#60a5fa", // Blue
  "#38bdf8", // Sky
  "#22d3ee", // Cyan
  "#2dd4bf", // Teal
];

export function GenreBreakdown() {
  const { data, isLoading } = useGenreBreakdown();

  const { chartData, total } = useMemo(() => {
    if (!data) return { chartData: [] as { name: string; value: number }[], total: 0 };
    const chart = Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    const totalVal = chart.reduce((sum, item) => sum + item.value, 0);
    return { chartData: chart, total: totalVal };
  }, [data]);

  return (
    <ChartCard
      title="Genre Breakdown"
      icon={<PieChartIcon className="h-5 w-5 text-purple-400" />}
      isLoading={isLoading}
      minHeight="min-h-[350px]"
      isEmpty={!data || Object.keys(data).length === 0}
      emptyMessage="No genre data yet"
      emptyDescription="Watch more titles to see your genre breakdown"
      emptyIcon={<PieChartIcon className="h-10 w-10" />}
    >
      <div className="flex flex-col lg:flex-row items-center gap-8">
        <div className="w-full lg:w-1/2">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    stroke="rgba(0,0,0,0.3)"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number | undefined) => [value ?? 0, "Shows"]}
                contentStyle={RECHARTS_TOOLTIP_STYLE.contentStyle}
                labelStyle={RECHARTS_TOOLTIP_STYLE.labelStyle}
                itemStyle={RECHARTS_TOOLTIP_STYLE.itemStyle}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-full lg:w-1/2">
          <div className="grid grid-cols-2 gap-3">
            {chartData.map((item, index) => {
              const percentage = ((item.value / total) * 100).toFixed(1);
              return (
                <div
                  key={item.name}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/3 transition-colors"
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-white/40">{percentage}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ChartCard>
  );
}
