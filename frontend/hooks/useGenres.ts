"use client";

import { useMemo } from "react";
import { useShows } from "./useShows";
import { useMovies } from "./useMovies";
import { parseGenres } from "@/lib/utils";

export function useGenres(mediaType?: "movies" | "shows") {
  const { data: showsData } = useShows(
    undefined,
    mediaType === "movies" ? { enabled: false } : undefined,
  );
  const { data: moviesData } = useMovies(
    undefined,
    mediaType === "shows" ? { enabled: false } : undefined,
  );

  const genres = useMemo(() => {
    const genreSet = new Set<string>();

    if (mediaType !== "movies") {
      showsData?.shows?.forEach((show) => {
        parseGenres(show.genre).forEach((g) => genreSet.add(g));
      });
    }

    if (mediaType !== "shows") {
      moviesData?.movies?.forEach((movie) => {
        parseGenres(movie.genre).forEach((g) => genreSet.add(g));
      });
    }

    return Array.from(genreSet).sort();
  }, [mediaType, showsData, moviesData]);

  return genres;
}
