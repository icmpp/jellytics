"use client";

import Link from "next/link";
import { Film, Tv, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type MediaFiltersState } from "@/hooks/useMediaFilters";

interface MediaEmptyStateProps {
  mediaType: "movies" | "shows";
  filters: MediaFiltersState;
  isEmptyLibrary: boolean;
  isSyncing?: boolean;
  onTriggerSync?: () => void;
}

function hasActiveFilters(f: MediaFiltersState): boolean {
  return !!(
    f.statusFilter ||
    f.searchFilter ||
    f.genreFilter ||
    f.yearFrom ||
    f.yearTo ||
    f.watchedFrom ||
    f.watchedTo ||
    (f.tagIds && f.tagIds.length > 0)
  );
}

function clearAllFilters(f: MediaFiltersState) {
  f.setStatusFilter("");
  f.setSearchFilter("");
  f.setGenreFilter("");
  f.setYearFrom(undefined);
  f.setYearTo(undefined);
  f.setWatchedFrom("");
  f.setWatchedTo("");
  f.setTagIds([]);
}

export function MediaEmptyState({
  mediaType,
  filters,
  isEmptyLibrary,
  isSyncing = false,
  onTriggerSync,
}: MediaEmptyStateProps) {
  const isMovies = mediaType === "movies";
  const label = isMovies ? "movies" : "shows";
  const Icon = isMovies ? Film : Tv;
  const filtersActive = hasActiveFilters(filters);

  if (filtersActive) {
    return (
      <div className="flex flex-col items-center py-24 px-4 text-center">
        <Icon className="h-12 w-12 text-white/15 mb-5" />
        <p className="text-base font-medium text-white/60 mb-1.5">
          {filters.searchFilter
            ? `No results for "${filters.searchFilter}"`
            : `No ${label} match your filters`}
        </p>
        <p className="text-sm text-white/30 mb-8">
          Try adjusting or clearing your filters
        </p>

        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {filters.statusFilter && (
            <FilterPill
              label={filters.statusFilter}
              onRemove={() => filters.setStatusFilter("")}
            />
          )}
          {filters.searchFilter && (
            <FilterPill
              label={`"${filters.searchFilter}"`}
              onRemove={() => filters.setSearchFilter("")}
            />
          )}
          {filters.genreFilter && (
            <FilterPill
              label={filters.genreFilter}
              onRemove={() => filters.setGenreFilter("")}
            />
          )}
          {(filters.yearFrom || filters.yearTo) && (
            <FilterPill
              label={`${filters.yearFrom ?? "…"}–${filters.yearTo ?? "…"}`}
              onRemove={() => {
                filters.setYearFrom(undefined);
                filters.setYearTo(undefined);
              }}
            />
          )}
          {(filters.watchedFrom || filters.watchedTo) && (
            <FilterPill
              label={`${filters.watchedFrom || "…"} to ${filters.watchedTo || "…"}`}
              onRemove={() => {
                filters.setWatchedFrom("");
                filters.setWatchedTo("");
              }}
            />
          )}
          {filters.tagIds && filters.tagIds.length > 0 && (
            <FilterPill
              label={`Tags (${filters.tagIds.length})`}
              onRemove={() => filters.setTagIds([])}
            />
          )}
        </div>

        <Button
          variant="outline"
          onClick={() => clearAllFilters(filters)}
          className="gap-2"
        >
          <X className="h-4 w-4" />
          Clear filters
        </Button>
      </div>
    );
  }

  if (isEmptyLibrary) {
    return (
      <div className="flex flex-col items-center py-24 px-4 text-center">
        <Icon className="h-12 w-12 text-white/15 mb-5" />
        <p className="text-base font-medium text-white/60 mb-1.5">
          No {label} yet
        </p>
        <p className="text-sm text-white/30 mb-8">
          {isSyncing
            ? "Syncing your library - check back in a moment."
            : "Sync your Jellyfin library to get started."}
        </p>

        {isSyncing ? (
          <div className="flex items-center gap-2 text-sm text-purple-400">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Syncing…
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {onTriggerSync && (
              <Button onClick={onTriggerSync} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Sync now
              </Button>
            )}
            <Link href="/settings">
              <Button
                variant="ghost"
                className="text-white/40 hover:text-white"
              >
                Settings
              </Button>
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-24 px-4 text-center">
      <Icon className="h-12 w-12 text-white/15 mb-5" />
      <p className="text-base font-medium text-white/60 mb-1.5">
        No {label} found
      </p>
      <p className="text-sm text-white/30 mb-8">
        Try adjusting your search or filters
      </p>

      {filters.statusFilter ? (
        <Button variant="outline" onClick={() => filters.setStatusFilter("")}>
          Show all {label}
        </Button>
      ) : (
        <Link href={isMovies ? "/shows" : "/movies"}>
          <Button
            variant="ghost"
            className="gap-2 text-white/40 hover:text-white"
          >
            {isMovies ? (
              <Tv className="h-4 w-4" />
            ) : (
              <Film className="h-4 w-4" />
            )}
            Browse {isMovies ? "shows" : "movies"}
          </Button>
        </Link>
      )}
    </div>
  );
}

function FilterPill({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <button
      onClick={onRemove}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white/50 hover:text-white/80 hover:bg-white/[0.08] transition-all group"
    >
      {label}
      <X className="h-3.5 w-3.5 text-white/20 group-hover:text-white/50 transition-colors" />
    </button>
  );
}
