"use client";

import { useGenreBreakdown } from "@/hooks/useStats";
import { Film, Crown, Medal, Award } from "lucide-react";
import { ChartCard } from "@/components/ui/chart-card";

const GENRE_COLORS = [
  {
    bar: "from-fuchsia-500 to-purple-500",
    bg: "bg-fuchsia-500",
    ring: "ring-fuchsia-400/30",
  },
  {
    bar: "from-violet-500 to-indigo-500",
    bg: "bg-violet-500",
    ring: "ring-violet-400/30",
  },
  {
    bar: "from-cyan-500 to-blue-500",
    bg: "bg-cyan-500",
    ring: "ring-cyan-400/30",
  },
  {
    bar: "from-emerald-500 to-teal-500",
    bg: "bg-emerald-500",
    ring: "ring-emerald-400/30",
  },
  {
    bar: "from-amber-500 to-orange-500",
    bg: "bg-amber-500",
    ring: "ring-amber-400/30",
  },
];

const PODIUM_ICONS = [Crown, Medal, Award];

interface GenreEntry {
  name: string;
  count: number;
}

function parseGenres(raw: Record<string, unknown> | undefined): GenreEntry[] {
  if (!raw || Object.keys(raw).length === 0) return [];
  return Object.entries(raw)
    .map(([name, count]) => ({ name, count: Number(count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export function TopGenres() {
  const { data: genres, isLoading } = useGenreBreakdown();

  const sortedGenres = parseGenres(genres);
  const maxCount = sortedGenres[0]?.count || 1;
  const totalCount = sortedGenres.reduce((sum, g) => sum + g.count, 0);
  const isEmpty = !isLoading && sortedGenres.length === 0;

  const diversityScore =
    sortedGenres.length > 1 && totalCount > 0
      ? (() => {
          const entropy = sortedGenres.reduce((sum, g) => {
            const p = g.count / totalCount;
            return p > 0 ? sum - p * Math.log2(p) : sum;
          }, 0);
          const maxEntropy = Math.log2(sortedGenres.length);
          return maxEntropy > 0 ? Math.round((entropy / maxEntropy) * 100) : 0;
        })()
      : 0;

  const topGenre = sortedGenres[0];
  const remainingGenres = sortedGenres.slice(1);

  return (
    <ChartCard
      title="Top Genres"
      icon={<Film className="h-5 w-5 text-purple-400" />}
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyMessage="No genre data yet"
      emptyDescription="Watch more titles to see your top genres"
      emptyIcon={<Film className="h-10 w-10" />}
      titleExtra={
        !isLoading && !isEmpty ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70">
            {sortedGenres.length} tracked
          </span>
        ) : null
      }
    >
      <div className="space-y-3">
        {topGenre && (
          <div className="relative overflow-hidden rounded-xl border border-fuchsia-400/20 bg-linear-to-br from-fuchsia-500/15 via-purple-500/10 to-transparent p-4">
            <div className="absolute top-2 right-2 opacity-[0.06]">
              <Crown className="h-16 w-16" />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fuchsia-500/20 ring-2 ring-fuchsia-400/30">
                <Crown className="h-5 w-5 text-fuchsia-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/50">
                  Your #1 genre
                </p>
                <p className="mt-0.5 text-base font-bold text-white truncate">{topGenre.name}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-bold text-fuchsia-300">
                  {totalCount > 0 ? ((topGenre.count / totalCount) * 100).toFixed(0) : 0}%
                </p>
                <p className="text-[11px] text-white/40">{topGenre.count} titles</p>
              </div>
            </div>
          </div>
        )}

        {remainingGenres.map((genre, i) => {
          const index = i + 1;
          const percentage = (genre.count / maxCount) * 100;
          const share = totalCount > 0 ? ((genre.count / totalCount) * 100).toFixed(1) : "0.0";
          const colors = GENRE_COLORS[index % GENRE_COLORS.length];
          const PodiumIcon = PODIUM_ICONS[index];

          return (
            <div
              key={genre.name}
              className="group rounded-xl border border-white/8 bg-white/2 p-3 transition-colors hover:bg-white/4"
            >
              <div className="flex items-center justify-between text-sm mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${index < 3 ? colors.bg + "/20 ring-2 " + colors.ring : "border border-white/10 bg-white/5"}`}
                  >
                    {PodiumIcon ? (
                      <PodiumIcon className="h-3.5 w-3.5 text-white/80" />
                    ) : (
                      <span className="text-xs font-semibold text-white/70">{index + 1}</span>
                    )}
                  </span>
                  <span className="font-medium text-white truncate">{genre.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-white/50">{share}%</span>
                  <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-xs font-medium text-white/70">
                    {genre.count}
                  </span>
                </div>
              </div>
              <div className="relative w-full h-2 rounded-full bg-white/8 overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full bg-linear-to-r ${colors.bar} transition-all duration-700 ease-out`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}

        {sortedGenres.length > 1 && (
          <div className="mt-1 flex items-center gap-3 rounded-xl border border-white/8 bg-white/2 px-3 py-2.5">
            <div className="relative h-9 w-9 shrink-0">
              <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90">
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="url(#diversityGrad)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${diversityScore * 0.942} 100`}
                />
                <defs>
                  <linearGradient id="diversityGrad">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/80">
                {diversityScore}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white/80">Taste Diversity</p>
              <p className="text-[11px] text-white/40">
                {diversityScore >= 80
                  ? "Eclectic viewer — wide range of genres"
                  : diversityScore >= 50
                    ? "Balanced mix across genres"
                    : "Focused on a few favorites"}
              </p>
            </div>
          </div>
        )}
      </div>
    </ChartCard>
  );
}
