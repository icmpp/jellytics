"use client";

import { Film, Tv, RefreshCw, X } from "lucide-react";
import { EmptyTerminal, TerminalAction } from "./EmptyTerminal";
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
  const label = mediaType; // "movies" | "shows"
  const Icon = isMovies ? Film : Tv;
  const OtherIcon = isMovies ? Tv : Film;
  const otherLabel = isMovies ? "shows" : "movies";

  // ── No results for the active filters ──────────────────────────────────────
  if (hasActiveFilters(filters)) {
    const command = (
      <>
        {label} <span className="text-violet-300/70">--filter</span>
        {filters.statusFilter && (
          <span className="text-violet-300/70"> --status {filters.statusFilter}</span>
        )}
      </>
    );

    return (
      <EmptyTerminal
        path={label}
        statusLabel="no match"
        command={command}
        output={
          <>
            query returned <span className="tabular-nums text-white/70">0</span> results
          </>
        }
        icon={Icon}
        headline={
          filters.searchFilter
            ? `no results for "${filters.searchFilter}"`
            : `no ${label} match your filters`
        }
        subtext="try adjusting or clearing your filters"
        actions={
          <TerminalAction icon={X} label="clear_filters" onClick={() => clearAllFilters(filters)} />
        }
      >
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          {filters.statusFilter && (
            <FilterPill label={filters.statusFilter} onRemove={() => filters.setStatusFilter("")} />
          )}
          {filters.searchFilter && (
            <FilterPill
              label={`"${filters.searchFilter}"`}
              onRemove={() => filters.setSearchFilter("")}
            />
          )}
          {filters.genreFilter && (
            <FilterPill label={filters.genreFilter} onRemove={() => filters.setGenreFilter("")} />
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
              label={`${filters.watchedFrom || "…"} → ${filters.watchedTo || "…"}`}
              onRemove={() => {
                filters.setWatchedFrom("");
                filters.setWatchedTo("");
              }}
            />
          )}
          {filters.tagIds && filters.tagIds.length > 0 && (
            <FilterPill
              label={`tags (${filters.tagIds.length})`}
              onRemove={() => filters.setTagIds([])}
            />
          )}
        </div>
      </EmptyTerminal>
    );
  }

  // ── Library has no items at all ────────────────────────────────────────────
  if (isEmptyLibrary) {
    return (
      <EmptyTerminal
        path={label}
        statusLabel="empty"
        command={
          <>
            {label} <span className="text-violet-300/70">--list</span>
          </>
        }
        output={
          isSyncing ? (
            <span className="text-violet-300/60">syncing library…</span>
          ) : (
            <>library is empty</>
          )
        }
        icon={Icon}
        headline={`no ${label} yet`}
        subtext={
          isSyncing
            ? "syncing your library — check back in a moment"
            : "sync your jellyfin library to get started"
        }
        actions={
          isSyncing ? (
            <span className="inline-flex items-center gap-2 font-mono text-xs text-violet-300">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              syncing…
            </span>
          ) : (
            <>
              {onTriggerSync && (
                <TerminalAction
                  icon={RefreshCw}
                  label="sync_now"
                  variant="primary"
                  onClick={onTriggerSync}
                />
              )}
              <TerminalAction href="/settings" label="settings" />
            </>
          )
        }
      />
    );
  }

  // ── No items found (e.g. a status filter with no matches) ──────────────────
  return (
    <EmptyTerminal
      path={label}
      statusLabel="empty"
      command={
        <>
          {label}
          {filters.statusFilter ? (
            <span className="text-violet-300/70"> --status {filters.statusFilter}</span>
          ) : (
            <span className="text-violet-300/70"> --list</span>
          )}
        </>
      }
      output={
        <>
          query returned <span className="tabular-nums text-white/70">0</span> results
        </>
      }
      icon={Icon}
      headline={`no ${label} found`}
      subtext="try adjusting your search or filters"
      actions={
        filters.statusFilter ? (
          <TerminalAction label={`show_all_${label}`} onClick={() => filters.setStatusFilter("")} />
        ) : (
          <TerminalAction href={`/${otherLabel}`} icon={OtherIcon} label={`browse_${otherLabel}`} />
        )
      }
    />
  );
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      onClick={onRemove}
      className="group inline-flex items-center gap-1.5 rounded-sm border border-[#16162a] bg-[#0a0a14] px-3 py-1.5 font-mono text-xs text-white/55 transition-colors hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-300"
    >
      {label}
      <X className="h-3 w-3 text-white/25 transition-colors group-hover:text-violet-300/70" />
    </button>
  );
}
