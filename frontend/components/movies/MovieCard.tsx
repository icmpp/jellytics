"use client";

import { memo } from "react";
import { Movie } from "@/hooks/useMovies";
import { MediaCard } from "@/components/media";
import { formatRuntime, getMoviePosterUrl, getWatchStatusText } from "@/lib/utils";

interface MovieCardProps {
  movie: Movie;
}

export const MovieCard = memo(function MovieCard({ movie }: MovieCardProps) {
  const partial = movie.completion_percentage > 0 && movie.completion_percentage < 100;

  return (
    <MediaCard
      itemType="movie"
      itemId={movie.id}
      href={`/movies/${movie.id}`}
      title={movie.title}
      posterUrl={movie.jellyfin_id ? getMoviePosterUrl(movie.jellyfin_id) : undefined}
      status={movie.status}
      genre={movie.genre}
      meta={[movie.year, formatRuntime(movie.runtime_minutes)]}
      progress={
        partial
          ? {
              label: getWatchStatusText(movie.status, { mediaType: "movie" }),
              value: movie.completion_percentage,
            }
          : undefined
      }
    />
  );
});
