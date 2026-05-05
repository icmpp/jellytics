"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { AppLayout, PageHeader } from "@/components/layout";
import { MediaFilters } from "./MediaFilters";
import { MediaEmptyState } from "./MediaEmptyState";
import { MediaGridSkeleton } from "@/components/ui/media-grid-skeleton";
import { RefetchingIndicator } from "@/components/ui/refetching-indicator";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowUp } from "lucide-react";
import { type MediaFiltersState } from "@/hooks/useMediaFilters";
import { MEDIA_GRID_CLASS, cn } from "@/lib/utils";

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
  itemLabel,
  filters,
  isLoading,
  isFetching,
  error,
  items,
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
  isEmptyLibrary,
  isSyncing = false,
  onTriggerSync,
  renderCard,
  getItemId,
}: MediaLibraryPageProps<T>) {
  const router = useRouter();
  const breadcrumbItems = [{ icon: "home" as const, href: "/dashboard" }, { label: title }];

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            fetchNextPage();
            break;
          }
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleShuffle = useCallback(() => {
    if (items.length === 0) return;
    const pick = items[Math.floor(Math.random() * items.length)];
    const id = getItemId(pick);
    router.push(`/${mediaType}/${id}`);
  }, [items, getItemId, mediaType, router]);

  return (
    <AppLayout>
      {/* Sticky header: breadcrumb + title + filters */}
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] md:top-0 z-10 -mx-4 px-4 md:-mx-8 md:px-8 pt-4 pb-4 bg-[#0d0d14] border-b border-white/6">
        <PageHeader
          breadcrumb={breadcrumbItems}
          title={title}
          sticky={false}
          actions={<RefetchingIndicator isFetching={isFetching} isLoading={isLoading} />}
        />
        <div className="mt-3">
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
            sort={filters.sort}
            onStatusChange={filters.setStatusFilter}
            onSearchChange={filters.setSearchFilter}
            onGenreChange={filters.setGenreFilter}
            onYearFromChange={filters.setYearFrom}
            onYearToChange={filters.setYearTo}
            onWatchedFromChange={filters.setWatchedFrom}
            onWatchedToChange={filters.setWatchedTo}
            onTagIdsChange={filters.setTagIds}
            onSortChange={filters.setSort}
            onApplyAll={filters.applyAll}
            onShuffle={items.length > 0 ? handleShuffle : undefined}
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="space-y-6 mt-5 md:mt-6">
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
                <div className={MEDIA_GRID_CLASS}>
                  {items.map((item, index) => (
                    <motion.div
                      key={`${filters.sort ?? "default"}-${getItemId(item)}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.2,
                        delay: Math.min(index * 0.035, 0.45),
                        ease: "easeOut",
                      }}
                    >
                      {renderCard(item)}
                    </motion.div>
                  ))}
                </div>

                {isFetchingNextPage && <MediaGridSkeleton count={8} />}

                {hasNextPage && (
                  <>
                    <div ref={sentinelRef} aria-hidden className="h-1 w-full" />
                    <div className="flex justify-center pt-4">
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
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>

      <JumpToTopButton />
    </AppLayout>
  );
}

function JumpToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 800);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Jump to top"
      className={cn(
        "fixed bottom-6 right-6 z-30 h-11 w-11 rounded-full",
        "bg-purple-500/90 text-white shadow-xl shadow-black/40",
        "hover:bg-purple-500 transition-colors",
        "flex items-center justify-center",
      )}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
