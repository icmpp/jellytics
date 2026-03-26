"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useGenreBreakdown } from "@/hooks/useStats";
import { Film } from "lucide-react";
import { PROGRESS_BAR_CLASS } from "@/lib/utils";
import { SectionHeader } from "@/components/layout";

export function TopGenres() {
  const { data: genres, isLoading } = useGenreBreakdown();

  const sortedGenres =
    genres && Object.keys(genres).length > 0
      ? Object.entries(genres)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 5)
      : [];

  const maxCount = (sortedGenres[0]?.[1] as number) || 1;
  const isEmpty = !isLoading && sortedGenres.length === 0;

  return (
    <Card className="h-full">
      <CardContent>
        <SectionHeader
          icon={<Film className="h-5 w-5 text-purple-400" />}
          title="Top Genres"
        />

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-white/10 rounded w-3/4 animate-pulse" />
                <div className="h-2 bg-white/10 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <div className="min-h-[220px] flex flex-col items-center justify-center text-center">
            <Film className="h-10 w-10 text-white/15 mb-3" />
            <p className="text-sm font-medium text-white/60">No genre data yet</p>
            <p className="text-xs text-white/40 mt-1">
              Watch more titles to see your top genres
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedGenres.map(([genre, count]) => {
              const percentage = ((count as number) / maxCount) * 100;
              return (
                <div key={genre} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-white">{genre}</span>
                    <span className="text-white/40">{count as number}</span>
                  </div>
                  <div className={PROGRESS_BAR_CLASS}>
                    <div
                      className="h-full bg-linear-to-r from-purple-500 to-purple-400 transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
