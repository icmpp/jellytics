"use client";

import { useMemo } from "react";
import { useMoviesInfinite } from "@/hooks/useMovies";
import { useMediaFilters } from "@/hooks/useMediaFilters";
import { usePreferences } from "@/hooks/usePreferences";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { MovieCard } from "@/components/movies/MovieCard";
import { MediaLibraryPage } from "@/components/media";

export default function MoviesPage() {
  const filters = useMediaFilters();
  const { isSyncing, triggerSync } = useSyncStatus();
  const { data: preferences } = usePreferences();
  const pageSize = preferences?.display_items_per_page ?? 50;

  const movieFilters = useMemo(
    () => ({
      status: filters.statusFilter || undefined,
      search: filters.searchFilter || undefined,
      genre: filters.genreFilter || undefined,
      yearFrom: filters.yearFrom,
      yearTo: filters.yearTo,
      watchedFrom: filters.watchedFrom || undefined,
      watchedTo: filters.watchedTo || undefined,
      tags: filters.tagIds.length > 0 ? filters.tagIds : undefined,
    }),
    [
      filters.statusFilter,
      filters.searchFilter,
      filters.genreFilter,
      filters.yearFrom,
      filters.yearTo,
      filters.watchedFrom,
      filters.watchedTo,
      filters.tagIds,
    ],
  );

  const { data, isLoading, isFetching, error, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useMoviesInfinite(movieFilters, pageSize);

  const movies = useMemo(() => data?.pages.flatMap((p) => p.movies) ?? [], [data]);
  const total = data?.pages[0]?.total ?? 0;

  const noFiltersActive = useMemo(
    () =>
      !filters.statusFilter &&
      !filters.searchFilter &&
      !filters.genreFilter &&
      !filters.yearFrom &&
      !filters.yearTo &&
      !filters.watchedFrom &&
      !filters.watchedTo &&
      filters.tagIds.length === 0,
    [
      filters.statusFilter,
      filters.searchFilter,
      filters.genreFilter,
      filters.yearFrom,
      filters.yearTo,
      filters.watchedFrom,
      filters.watchedTo,
      filters.tagIds,
    ],
  );

  const isEmptyLibrary = !isLoading && !!data && total === 0 && noFiltersActive;

  return (
    <MediaLibraryPage
      mediaType="movies"
      title="Movies"
      description="Your movie library"
      itemLabel="movie"
      filters={filters}
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      items={movies}
      total={total}
      hasNextPage={!!hasNextPage}
      fetchNextPage={fetchNextPage}
      isFetchingNextPage={isFetchingNextPage}
      isEmptyLibrary={isEmptyLibrary}
      isSyncing={isSyncing}
      onTriggerSync={triggerSync}
      renderCard={(movie) => <MovieCard movie={movie} />}
      getItemId={(m) => m.id}
    />
  );
}
