"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useShowsInfinite } from "@/hooks/useShows";
import { useMediaFilters } from "@/hooks/useMediaFilters";
import { usePreferences } from "@/hooks/usePreferences";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { useViewPrefs } from "@/hooks/useViewPrefs";
import { ShowCard } from "@/components/shows/ShowCard";
import { MediaLibraryPage } from "@/components/media";

function ShowsPageContent() {
  const filters = useMediaFilters();
  const { isSyncing, triggerSync } = useSyncStatus();
  const { data: preferences } = usePreferences();
  const pageSize = preferences?.display_items_per_page ?? 50;
  const viewPrefs = useViewPrefs("shows");

  const appliedDefaultRef = useRef(false);
  useEffect(() => {
    if (appliedDefaultRef.current) return;
    appliedDefaultRef.current = true;
    if (!filters.sort && viewPrefs.defaultSort) {
      filters.setSort(viewPrefs.defaultSort);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewPrefs.defaultSort]);

  useEffect(() => {
    if (filters.sort && filters.sort !== viewPrefs.defaultSort) {
      viewPrefs.setDefaultSort(filters.sort);
    }
  }, [filters.sort, viewPrefs]);

  const showFilters = useMemo(
    () => ({
      status: filters.statusFilter || undefined,
      search: filters.searchFilter || undefined,
      genre: filters.genreFilter || undefined,
      yearFrom: filters.yearFrom,
      yearTo: filters.yearTo,
      watchedFrom: filters.watchedFrom || undefined,
      watchedTo: filters.watchedTo || undefined,
      tags: filters.tagIds.length > 0 ? filters.tagIds : undefined,
      sort: filters.sort || undefined,
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
      filters.sort,
    ],
  );

  const { data, isLoading, isFetching, error, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useShowsInfinite(showFilters, pageSize);

  const shows = useMemo(() => data?.pages.flatMap((p) => p.shows ?? []) ?? [], [data]);
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
      mediaType="shows"
      title="Shows"
      description="Your TV show library"
      itemLabel="show"
      filters={filters}
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      items={shows}
      total={total}
      hasNextPage={!!hasNextPage}
      fetchNextPage={fetchNextPage}
      isFetchingNextPage={isFetchingNextPage}
      isEmptyLibrary={isEmptyLibrary}
      isSyncing={isSyncing}
      onTriggerSync={triggerSync}
      renderCard={(show) => <ShowCard show={show} />}
      getItemId={(s) => s.id}
    />
  );
}

export default function ShowsPage() {
  return (
    <Suspense>
      <ShowsPageContent />
    </Suspense>
  );
}
