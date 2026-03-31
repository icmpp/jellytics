"use client";

import { useMemo, useState } from "react";
import { useMovies } from "@/hooks/useMovies";
import { useShows } from "@/hooks/useShows";
import { Trophy, Clock, Film, Tv, ChevronRight } from "lucide-react";
import Link from "next/link";
import { getMoviePosterUrl, getShowPosterUrl, formatRuntime } from "@/lib/utils";
import { PosterImage } from "@/components/ui/poster-image";
import { ChartCard } from "@/components/ui/chart-card";

type MostWatchedItem = {
  id: number;
  jellyfin_id: string;
  title: string;
  type: "movie" | "show";
  total_watch_time_minutes: number;
  year?: number;
  status: string;
  watch_count?: number;
  watched_episodes?: number;
  total_episodes?: number;
};

type FilterType = "all" | "movies" | "shows";

export function MostWatched() {
  const [filter, setFilter] = useState<FilterType>("all");
  const { data: moviesData, isLoading: moviesLoading } = useMovies();
  const { data: showsData, isLoading: showsLoading } = useShows();

  const isLoading = moviesLoading || showsLoading;

  const mostWatchedItems = useMemo(() => {
    const items: MostWatchedItem[] = [];

    if (moviesData?.movies && (filter === "all" || filter === "movies")) {
      moviesData.movies
        .filter((movie) => movie.total_watch_time_minutes > 0)
        .forEach((movie) => {
          items.push({
            id: movie.id,
            jellyfin_id: movie.jellyfin_id,
            title: movie.title,
            type: "movie",
            total_watch_time_minutes: movie.total_watch_time_minutes,
            year: movie.year,
            status: movie.status,
            watch_count: movie.watch_count,
          });
        });
    }

    if (showsData?.shows && (filter === "all" || filter === "shows")) {
      showsData.shows
        .filter((show) => show.total_watch_time_minutes > 0)
        .forEach((show) => {
          items.push({
            id: show.id,
            jellyfin_id: show.jellyfin_id,
            title: show.title,
            type: "show",
            total_watch_time_minutes: show.total_watch_time_minutes,
            year: show.year,
            status: show.status,
            watched_episodes: show.watched_episodes,
            total_episodes: show.total_episodes,
          });
        });
    }

    return items.sort((a, b) => b.total_watch_time_minutes - a.total_watch_time_minutes);
  }, [moviesData, showsData, filter]);

  const getRankStyle = (index: number) => {
    if (index === 0)
      return { bg: "bg-amber-500/20", border: "border-amber-500/30", text: "text-amber-400" };
    if (index === 1)
      return { bg: "bg-slate-400/20", border: "border-slate-400/30", text: "text-slate-300" };
    if (index === 2)
      return { bg: "bg-orange-600/20", border: "border-orange-600/30", text: "text-orange-400" };
    return { bg: "bg-white/3", border: "border-white/6", text: "text-white/40" };
  };

  const topItems = mostWatchedItems.slice(0, 10);

  const filterButtons: { key: FilterType; label: string; icon?: typeof Film }[] = [
    { key: "all", label: "All" },
    { key: "movies", label: "Movies", icon: Film },
    { key: "shows", label: "Shows", icon: Tv },
  ];

  return (
    <ChartCard
      title="Most Watched"
      icon={<Trophy className="h-5 w-5 text-amber-400" />}
      isLoading={isLoading}
      minHeight="min-h-[300px]"
      isEmpty={topItems.length === 0}
      emptyMessage="No watch history yet"
      emptyDescription="Start watching to see your most watched content"
      emptyIcon={<Trophy className="h-10 w-10" />}
      titleExtra={
        <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5">
          {filterButtons.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-200 ${
                filter === key
                  ? "bg-purple-500/30 text-purple-100 shadow-sm shadow-purple-500/20"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {Icon && <Icon className="h-3 w-3" />}
              {label}
            </button>
          ))}
        </div>
      }
    >
      <div className="space-y-1">
        {topItems.map((item, index) => {
          const rankStyle = getRankStyle(index);
          return (
            <Link
              key={`${item.type}-${item.id}`}
              href={item.type === "movie" ? `/movies/${item.id}` : `/shows/${item.id}`}
              className="group block"
            >
              <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/4 transition-colors">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold border ${rankStyle.bg} ${rankStyle.border} ${rankStyle.text}`}
                >
                  {index + 1}
                </div>

                <div className="relative w-9 h-13 shrink-0 rounded-lg overflow-hidden bg-white/5">
                  <PosterImage
                    src={
                      item.jellyfin_id
                        ? item.type === "movie"
                          ? getMoviePosterUrl(item.jellyfin_id)
                          : getShowPosterUrl(item.jellyfin_id)
                        : undefined
                    }
                    alt={item.title}
                    type={item.type}
                    sizes="36px"
                    iconSize="h-3.5 w-3.5"
                    showLabel={false}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-white truncate group-hover:text-purple-400 transition-colors">
                      {item.title}
                    </h4>
                    <span
                      className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${
                        item.type === "movie"
                          ? "bg-blue-500/10 text-blue-400/70"
                          : "bg-emerald-500/10 text-emerald-400/70"
                      }`}
                    >
                      {item.type === "movie" ? "Movie" : "Show"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-white/40 mt-0.5">
                    {item.year && <span>{item.year}</span>}
                    {item.year && (item.watch_count || item.watched_episodes !== undefined) && (
                      <span className="text-white/20">·</span>
                    )}
                    {item.type === "movie" && item.watch_count && item.watch_count > 0 && (
                      <span>{item.watch_count}× watched</span>
                    )}
                    {item.type === "show" && item.watched_episodes !== undefined && (
                      <span>
                        {item.watched_episodes}
                        {item.total_episodes ? `/${item.total_episodes}` : ""} eps
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-white tabular-nums">
                      {formatRuntime(item.total_watch_time_minutes)}
                    </div>
                    <div className="text-[10px] text-white/30 flex items-center justify-end gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      total
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/10 group-hover:text-white/30 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </ChartCard>
  );
}
