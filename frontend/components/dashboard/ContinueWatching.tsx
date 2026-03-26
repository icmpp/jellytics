"use client";

import { useMemo } from "react";
import Link from "next/link";
import { PlayCircle } from "lucide-react";
import { useMovies } from "@/hooks/useMovies";
import { useShows } from "@/hooks/useShows";
import { PosterImage } from "@/components/ui/poster-image";
import { SectionHeader } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { getMoviePosterUrl, getShowPosterUrl } from "@/lib/utils";

interface ContinueItem {
  id: number;
  title: string;
  type: "movie" | "show";
  posterUrl: string;
  progress: number;
  lastWatchedAt?: string;
  episodesLeft?: number;
}

export function ContinueWatching() {
  const { data: moviesData } = useMovies({ status: "watching" });
  const { data: showsData } = useShows({ status: "watching" });

  const top = useMemo(() => {
    const items: ContinueItem[] = [];
    moviesData?.movies?.forEach((m) => {
      items.push({
        id: m.id,
        title: m.title,
        type: "movie",
        posterUrl: getMoviePosterUrl(m.jellyfin_id),
        progress: Math.round(m.completion_percentage ?? 0),
        lastWatchedAt: m.last_watched_at,
      });
    });
    showsData?.shows?.forEach((s) => {
      const total = s.total_episodes ?? 0;
      const watched = s.watched_episodes ?? 0;
      const pct = total > 0 ? Math.round((watched / total) * 100) : 0;
      items.push({
        id: s.id,
        title: s.title,
        type: "show",
        posterUrl: getShowPosterUrl(s.jellyfin_id),
        progress: pct,
        lastWatchedAt: s.last_watched_at,
        episodesLeft: total > 0 ? total - watched : undefined,
      });
    });
    items.sort((a, b) => {
      if (!a.lastWatchedAt) return 1;
      if (!b.lastWatchedAt) return -1;
      return (
        new Date(b.lastWatchedAt).getTime() -
        new Date(a.lastWatchedAt).getTime()
      );
    });
    return items.slice(0, 10);
  }, [moviesData?.movies, showsData?.shows]);

  return (
    <Card>
      <CardContent>
        <SectionHeader
          icon={<PlayCircle className="h-5 w-5 text-blue-400" />}
          title="Continue Watching"
        />
        {top.length === 0 ? (
          <div className="min-h-[220px] flex flex-col items-center justify-center text-center">
            <PlayCircle className="h-10 w-10 text-white/15 mb-3" />
            <p className="text-sm font-medium text-white/60">Nothing in progress</p>
            <p className="text-xs text-white/40 mt-1">
              Start watching a movie or show to pick up here
            </p>
          </div>
        ) : (
          <div className="flex gap-4 sm:gap-5 overflow-x-auto pb-2 scrollbar-none scroll-snap-x">
        {top.map((item) => (
          <Link
            key={`${item.type}-${item.id}`}
            href={item.type === "movie" ? `/movies/${item.id}` : `/shows/${item.id}`}
            className="group shrink-0 w-36 sm:w-40 md:w-44 scroll-snap-start"
          >
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-white/[0.04] border border-white/[0.08] mb-2">
              <PosterImage
                src={item.posterUrl}
                alt={item.title}
                type={item.type}
                sizes="176px"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/40">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            </div>
            <p className="text-sm text-white/80 truncate group-hover:text-white transition-colors leading-tight">
              {item.title}
            </p>
            {item.episodesLeft !== undefined && (
              <p className="text-xs text-white/40 mt-1">
                {item.episodesLeft} ep left
              </p>
            )}
            {item.type === "movie" && item.progress > 0 && (
              <p className="text-xs text-white/40 mt-1">{item.progress}% watched</p>
            )}
          </Link>
        ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
