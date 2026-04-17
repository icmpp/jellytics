"use client";

import { Fragment } from "react";
import { AppLayout, PageHeader } from "@/components/layout";
import { MediaFilters } from "./MediaFilters";
import { MediaEmptyState } from "./MediaEmptyState";
import { MediaGridSkeleton } from "@/components/ui/media-grid-skeleton";
import { RefetchingIndicator } from "@/components/ui/refetching-indicator";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { type MediaFiltersState } from "@/hooks/useMediaFilters";
import { MEDIA_GRID_CLASS } from "@/lib/utils";

interface MediaLibraryPageProps<T> {
  mediaType: "movies" | "shows";
  title: string;
  description: string;
  itemLabel: string; // "movie" | "show"
  filters: MediaFiltersState;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  items: T[];
  total: number;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
  isEmptyLibrary: boolean;
  isSyncing?: boolean;
  onTriggerSync?: () => void;
  renderCard: (item: T) => React.ReactNode;
  getItemId: (item: T) => number;
}

export function MediaLibraryPage<T>({
  mediaType,
  title,
  description,
  itemLabel,
  filters,
  isLoading,
  isFetching,
  error,
  items,
  total,
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
  isEmptyLibrary,
  isSyncing = false,
  onTriggerSync,
  renderCard,
  getItemId,
}: MediaLibraryPageProps<T>) {
  const breadcrumbItems = [{ icon: "home" as const, href: "/dashboard" }, { label: title }];

  return (
    <AppLayout>
      {/* Unified sticky banner: title + filters */}
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] md:top-0 z-10 -mx-4 px-4 md:-mx-8 md:px-8 md:-mt-8 md:pt-8 pb-5 bg-app-shell border-b border-white/6">
        <PageHeader breadcrumb={breadcrumbItems} title={title} description={description} sticky={false} />
        <div className="mt-4">
          <MediaFilters
            mediaType={mediaType}
            status={filters.statusFilter}
            search={filters.searchFilter}
            genre={filters.genreFilter}
            yearFrom={filters.yearFrom}
            yearTo={filters.yearTo}
            watchedFrom={filters.watchedFrom}
            watchedTo={filters.watchedTo}
            tagIds={filters.tagIds}
            onStatusChange={filters.setStatusFilter}
            onSearchChange={filters.setSearchFilter}
            onGenreChange={filters.setGenreFilter}
            onYearFromChange={filters.setYearFrom}
            onYearToChange={filters.setYearTo}
            onWatchedFromChange={filters.setWatchedFrom}
            onWatchedToChange={filters.setWatchedTo}
            onTagIdsChange={filters.setTagIds}
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="space-y-6 mt-6 md:mt-8">
        {isLoading && <MediaGridSkeleton />}

        {error && (
          <div className="text-center py-12">
            <p className="text-red-400">Error loading {itemLabel}s</p>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {items.length === 0 ? (
              <MediaEmptyState
                mediaType={mediaType}
                filters={filters}
                isEmptyLibrary={isEmptyLibrary}
                isSyncing={isSyncing}
                onTriggerSync={onTriggerSync}
              />
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <p className="text-sm text-white/40">
                    {items.length} of {total} {itemLabel}
                    {total !== 1 ? "s" : ""}
                  </p>
                  <RefetchingIndicator isFetching={isFetching} isLoading={isLoading} />
                </div>
                <div className={MEDIA_GRID_CLASS}>
                  {items.map((item) => (
                    <Fragment key={getItemId(item)}>{renderCard(item)}</Fragment>
                  ))}
                </div>
                {hasNextPage && (
                  <div className="flex justify-center pt-8">
                    <Button
                      variant="outline"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="min-w-[160px]"
                    >
                      {isFetchingNextPage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Load more"
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
