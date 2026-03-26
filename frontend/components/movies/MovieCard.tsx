"use client";

import { memo } from "react";
import { Movie } from "@/hooks/useMovies";
import Link from "next/link";
import {
  getMoviePosterUrl,
  formatRuntime,
  getWatchStatusText,
  cn,
  MEDIA_CARD_BASE,
  PROGRESS_BAR_CLASS,
  MEDIA_CARD_TITLE_CLASS,
} from "@/lib/utils";
import { PosterImage } from "@/components/ui/poster-image";

interface MovieCardProps {
  movie: Movie;
}

export const MovieCard = memo(function MovieCard({ movie }: MovieCardProps) {
  const watchStatusText = getWatchStatusText(movie.status, {
    watchCount: movie.watch_count,
    mediaType: "movie",
  });

  return (
    <Link
      href={`/movies/${movie.id}`}
      aria-label={`View details for ${movie.title}`}
      className="block min-w-0 h-full"
    >
      <div className={cn(MEDIA_CARD_BASE, "group h-full flex flex-col cursor-pointer")}>
        <div className="relative aspect-[2/3] w-full overflow-hidden shrink-0">
          <PosterImage
            src={
              movie.jellyfin_id
                ? getMoviePosterUrl(movie.jellyfin_id)
                : undefined
            }
            alt={`Poster for ${movie.title}`}
            type="movie"
            hoverScale
          />
          {movie.completion_percentage > 0 &&
            movie.completion_percentage < 100 && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm px-3 py-2">
                <div className={cn(PROGRESS_BAR_CLASS, "mb-1.5")}>
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-purple-400 transition-all"
                    style={{ width: `${movie.completion_percentage}%` }}
                  />
                </div>
                <div className="text-xs text-white/60 text-center">
                  {Math.round(movie.completion_percentage)}% watched
                </div>
              </div>
            )}
        </div>
        <div className="p-4 flex-1 min-h-0 flex flex-col">
          <h3 className={MEDIA_CARD_TITLE_CLASS}>
            {movie.title}
          </h3>
          <div className="flex items-center gap-2 text-xs text-white/40">
            {movie.year && <span>{movie.year}</span>}
            {movie.runtime_minutes && (
              <>
                {movie.year && <span>•</span>}
                <span>{formatRuntime(movie.runtime_minutes)}</span>
              </>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-white/30">
            <span>{watchStatusText}</span>
            {movie.completion_percentage > 0 &&
              movie.completion_percentage < 100 && (
                <span className="text-white/50 shrink-0">
                  {Math.round(movie.completion_percentage)}%
                </span>
              )}
          </div>
        </div>
      </div>
    </Link>
  );
});
