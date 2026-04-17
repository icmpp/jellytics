"use client";

import { useMemo, useState, useId } from "react";
import { useGenreBreakdown } from "@/hooks/useStats";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Label } from "recharts";
import { PieChart as PieChartIcon, Sparkles } from "lucide-react";
import { ChartCard } from "@/components/ui/chart-card";

const COLORS = [
  "#a855f7",
  "#c084fc",
  "#8b5cf6",
  "#7c3aed",
  "#6366f1",
  "#818cf8",
  "#60a5fa",
  "#38bdf8",
  "#22d3ee",
  "#2dd4bf",
];

interface ChartPoint {
  name: string;
  value: number;
}

function GenreTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
  label?: string;
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0.0";

  return (
    <div className="rounded-xl border border-white/10 bg-[rgba(16,16,24,0.96)] px-4 py-3 shadow-xl shadow-black/50 backdrop-blur-sm">
      <p className="mb-1.5 text-xs font-semibold text-white">{item.name}</p>
      <div className="flex items-baseline gap-2">
        <span className="tabular-nums text-sm font-bold text-white">{item.value}</span>
        <span className="text-[11px] text-white/40">titles</span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="tabular-nums text-sm font-medium text-white/70">{pct}%</span>
        <span className="text-[11px] text-white/40">of library</span>
      </div>
    </div>
  );
}

export function GenreBreakdown() {
  const { data, isLoading } = useGenreBreakdown();
  const [activeIndex, setActiveIndex] = useState(0);
  const gradientId = useId().replace(/:/g, "");

  const { chartData, total } = useMemo(() => {
    if (!data) return { chartData: [] as ChartPoint[], total: 0 };
    const chart = Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    const totalVal = chart.reduce((sum, item) => sum + item.value, 0);
    return { chartData: chart, total: totalVal };
  }, [data]);

  const activeGenre = chartData[activeIndex] ?? chartData[0];
  const leadingGenre = chartData[0];

  const diversityScore = useMemo(() => {
    if (chartData.length < 2 || total === 0) return 0;
    const entropy = chartData.reduce((sum, item) => {
      const p = item.value / total;
      return p > 0 ? sum - p * Math.log2(p) : sum;
    }, 0);
    const maxEntropy = Math.log2(chartData.length);
    return maxEntropy > 0 ? Math.round((entropy / maxEntropy) * 100) : 0;
  }, [chartData, total]);

  const diversityLabel =
    diversityScore >= 80
      ? "Eclectic viewer"
      : diversityScore >= 50
        ? "Balanced mix"
        : "Focused taste";

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
      className="h-full"
      titleExtra={
        !isLoading && leadingGenre ? (
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70">
              {chartData.length} genres
            </span>
            <span className="rounded-full border border-purple-400/20 bg-purple-500/10 px-2.5 py-1 text-xs text-purple-200">
              {total} titles
            </span>
          </div>
        ) : null
      }
    >
      {/* Genre DNA bar + active callout */}
      {chartData.length > 0 && (
        <div className="mb-5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Genre DNA</p>
            {activeGenre && (
              <p className="text-[11px] text-white/50 tabular-nums">
                <span className="font-medium text-white/70">{activeGenre.name}</span> —{" "}
                {((activeGenre.value / total) * 100).toFixed(1)}%
              </p>
            )}
          </div>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full">
            {chartData.map((item, index) => (
              <div
                key={item.name}
                className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full cursor-pointer"
                style={{
                  width: `${(item.value / total) * 100}%`,
                  backgroundColor: COLORS[index % COLORS.length],
                  opacity: activeIndex === index ? 1 : 0.65,
                }}
                onMouseEnter={() => setActiveIndex(index)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row items-center gap-6">
        {/* Donut */}
        <div className="w-full lg:w-5/12">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <defs>
                <linearGradient id={`${gradientId}-ring`}>
                  <stop offset="0%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={108}
                paddingAngle={2}
                dataKey="value"
                onMouseEnter={(_, index) => setActiveIndex(index)}
                animationBegin={0}
                animationDuration={800}
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    stroke="rgba(0,0,0,0.4)"
                    strokeWidth={1}
                    opacity={activeIndex === index || activeIndex === -1 ? 1 : 0.5}
                    className="transition-opacity duration-200"
                  />
                ))}
                <Label
                  content={({ viewBox }) => {
                    if (!viewBox) return null;
                    const { cx, cy } = viewBox as { cx: number; cy: number };
                    const percent =
                      activeGenre && total > 0
                        ? ((activeGenre.value / total) * 100).toFixed(1)
                        : "0.0";
                    return (
                      <g>
                        <text
                          x={cx}
                          y={cy - 12}
                          textAnchor="middle"
                          className="fill-white/80"
                          fontSize={13}
                          fontWeight={600}
                        >
                          {activeGenre?.name ?? "Genres"}
                        </text>
                        <text
                          x={cx}
                          y={cy + 12}
                          textAnchor="middle"
                          className="fill-white"
                          fontSize={22}
                          fontWeight={700}
                        >
                          {percent}%
                        </text>
                        <text
                          x={cx}
                          y={cy + 30}
                          textAnchor="middle"
                          className="fill-white/40"
                          fontSize={11}
                        >
                          {activeGenre?.value ?? 0} titles
                        </text>
                      </g>
                    );
                  }}
                />
              </Pie>
              <Tooltip
                content={(props) => (
                  <GenreTooltip
                    {...(props as unknown as Parameters<typeof GenreTooltip>[0])}
                    total={total}
                  />
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend + insights */}
        <div className="w-full lg:w-7/12 space-y-3">
          {/* Quick insights row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/8 bg-white/3 p-2.5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-white/45">Top Genre</p>
              <p className="mt-1 text-sm font-semibold text-white truncate">
                {leadingGenre?.name ?? "—"}
              </p>
              {leadingGenre && total > 0 && (
                <p className="mt-0.5 text-[11px] tabular-nums text-white/40">
                  {((leadingGenre.value / total) * 100).toFixed(0)}% of library
                </p>
              )}
            </div>
            <div className="rounded-xl border border-white/8 bg-white/3 p-2.5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-white/45">Diversity</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-white">{diversityScore}%</p>
                    <Sparkles className="h-3 w-3 text-purple-400" />
                  </div>
                </div>
                <div className="relative h-8 w-8 shrink-0">
                  <svg viewBox="0 0 36 36" className="h-8 w-8 -rotate-90">
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke="rgba(255,255,255,0.06)"
                      strokeWidth="3"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke={`url(#${gradientId}-ring)`}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={`${diversityScore * 0.88} 100`}
                    />
                  </svg>
                </div>
              </div>
              <p className="mt-0.5 text-[11px] text-white/35">{diversityLabel}</p>
            </div>
          </div>

          {/* Legend grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {chartData.map((item, index) => {
              const percentage = ((item.value / total) * 100).toFixed(1);
              const isActive = activeGenre?.name === item.name;
              return (
                <div
                  key={item.name}
                  className={`group flex items-center gap-2.5 p-2 rounded-xl border transition-all duration-200 cursor-default ${
                    isActive
                      ? "bg-white/6 border-white/15 shadow-sm shadow-white/4"
                      : "bg-white/2 border-white/6 hover:bg-white/4"
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <div
                    className={`h-3 w-3 rounded-md shrink-0 transition-transform duration-200 ${isActive ? "scale-125" : ""}`}
                    style={{
                      backgroundColor: COLORS[index % COLORS.length],
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-white truncate leading-tight">
                      {item.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="h-1 flex-1 rounded-full bg-white/6 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: COLORS[index % COLORS.length],
                          }}
                        />
                      </div>
                      <span className="text-[11px] text-white/50 tabular-nums shrink-0">
                        {percentage}%
                      </span>
                    </div>
                  </div>
                  <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-xs font-medium text-white/70 tabular-nums shrink-0">
                    {item.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ChartCard>
  );
}
