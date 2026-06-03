"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { MultiCombobox } from "@/components/ui/combobox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Search,
  Shuffle,
  X,
  SlidersHorizontal,
  Calendar,
  Film,
  CalendarDays,
  Tag,
  Bookmark,
  Plus,
  ChevronDown,
} from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { useTags } from "@/hooks/useTags";
import { useGenres } from "@/hooks/useGenres";
import { useStatusCounts, type StatusCounts } from "@/hooks/useStatusCounts";
import { useViewPrefs, type FilterPreset } from "@/hooks/useViewPrefs";
import type { MediaFiltersSnapshot } from "@/hooks/useMediaFilters";
import { useState, useEffect, useMemo, useRef } from "react";
import { format } from "date-fns";
import { SortSelect } from "./SortSelect";
import { StatusSegmented } from "./StatusSegmented";
import { cn } from "@/lib/utils";

const YEAR_MIN = 1950;

export interface MediaFiltersProps {
  mediaType: "movies" | "shows";
  status: string;
  search: string;
  genre?: string;
  yearFrom?: number;
  yearTo?: number;
  watchedFrom?: string;
  watchedTo?: string;
  tagIds?: number[];
  sort: string;
  onStatusChange: (status: string) => void;
  onSearchChange: (search: string) => void;
  onGenreChange: (genre: string) => void;
  onYearFromChange: (year: number | undefined) => void;
  onYearToChange: (year: number | undefined) => void;
  onWatchedFromChange: (date: string) => void;
  onWatchedToChange: (date: string) => void;
  onTagIdsChange?: (tagIds: number[]) => void;
  onSortChange: (sort: string) => void;
  onApplyAll?: (partial: Partial<MediaFiltersSnapshot>) => void;
  onShuffle?: () => void;
}

export function MediaFilters({
  mediaType,
  status,
  search,
  genre,
  yearFrom,
  yearTo,
  watchedFrom,
  watchedTo,
  tagIds = [],
  sort,
  onStatusChange,
  onSearchChange,
  onGenreChange,
  onYearFromChange,
  onYearToChange,
  onWatchedFromChange,
  onWatchedToChange,
  onTagIdsChange,
  onSortChange,
  onApplyAll,
  onShuffle,
}: MediaFiltersProps) {
  const [searchValue, setSearchValue] = useState(search);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(searchValue, 300);

  // Press "/" anywhere (outside a field) to jump into search — mirrors the
  // sidebar's command-palette keyboard affordance.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return;
      e.preventDefault();
      searchBoxRef.current?.querySelector("input")?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  const genres = useGenres(mediaType);
  const { data: tags = [] } = useTags();
  const prefs = useViewPrefs(mediaType);

  const currentYear = useMemo(() => new Date().getFullYear(), []);

  const { data: counts } = useStatusCounts(mediaType, {
    search: search || undefined,
    genre: genre || undefined,
    yearFrom,
    yearTo,
    watchedFrom: watchedFrom || undefined,
    watchedTo: watchedTo || undefined,
    tags: tagIds.length > 0 ? tagIds : undefined,
  });

  const label = mediaType === "movies" ? "Movies" : "Shows";
  const searchPlaceholder = `search ${label.toLowerCase()}...`;

  useEffect(() => {
    setSearchValue(search);
  }, [search]);

  useEffect(() => {
    if (debouncedSearch !== search) {
      onSearchChange(debouncedSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const advancedFilterCount = [
    genre,
    yearFrom,
    yearTo,
    watchedFrom,
    watchedTo,
    tagIds.length > 0,
  ].filter(Boolean).length;

  const hasActiveFilters =
    !!genre || !!yearFrom || !!yearTo || !!watchedFrom || !!watchedTo || tagIds.length > 0;

  const sliderValue: [number, number] = [yearFrom ?? YEAR_MIN, yearTo ?? currentYear];

  const handleYearCommit = (values: number[]) => {
    const [from, to] = values;
    onYearFromChange(from === YEAR_MIN ? undefined : from);
    onYearToChange(to === currentYear ? undefined : to);
  };

  const clearAll = () => {
    onGenreChange("");
    onYearFromChange(undefined);
    onYearToChange(undefined);
    onWatchedFromChange("");
    onWatchedToChange("");
    onTagIdsChange?.([]);
    setSearchValue("");
    onSearchChange("");
  };

  const tagOptions = useMemo(
    () => tags.map((t) => ({ value: t.id, label: t.name, color: t.color })),
    [tags],
  );

  const currentSnapshot: Partial<MediaFiltersSnapshot> = {
    status,
    search,
    genre,
    yearFrom,
    yearTo,
    watchedFrom,
    watchedTo,
    tagIds,
    sort,
  };

  // Vim-style status line: the active query rendered as a command string.
  const yearLabel =
    yearFrom || yearTo
      ? yearFrom === yearTo
        ? `${yearFrom}`
        : `${yearFrom ?? YEAR_MIN}-${yearTo ?? currentYear}`
      : null;
  let watchedLabel: string | null = null;
  if (watchedFrom && watchedTo) watchedLabel = `${watchedFrom}→${watchedTo}`;
  else if (watchedFrom) watchedLabel = `≥${watchedFrom}`;
  else if (watchedTo) watchedLabel = `≤${watchedTo}`;

  const filterTokens = (
    [
      status ? { key: "status", val: status } : null,
      search ? { key: "q", val: `"${search}"` } : null,
      genre ? { key: "genre", val: genre } : null,
      yearLabel ? { key: "year", val: yearLabel } : null,
      watchedLabel ? { key: "watched", val: watchedLabel } : null,
      tagIds.length > 0 ? { key: "tags", val: String(tagIds.length) } : null,
      sort ? { key: "sort", val: sort } : null,
    ] as ({ key: string; val: string } | null)[]
  ).filter((t): t is { key: string; val: string } => t !== null);

  const statusCountKey = (status === "" ? "all" : status) as keyof StatusCounts;
  const resultCount = counts ? counts[statusCountKey] : undefined;

  return (
    <div className="space-y-2">
      {/* Main toolbar */}
      <div className="flex items-center gap-2">
        <div ref={searchBoxRef} className="relative min-w-0 flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="h-11 rounded-sm border-[#16162a] bg-[#0a0a14] pl-10 pr-9 font-mono focus:border-violet-500/50 focus:bg-[#0d0d1a] focus:ring-violet-500/20"
          />
          <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
            {searchValue ? (
              <button
                className="rounded-sm p-1 text-white/40 transition-colors hover:bg-[#0d0d1a] hover:text-white"
                onClick={() => setSearchValue("")}
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <>
                {!searchFocused && (
                  <kbd
                    className="hidden select-none rounded-sm px-1.5 py-0.5 text-[10px] font-mono text-violet-300/70 sm:block"
                    style={{
                      background: "rgba(139,92,246,0.12)",
                      border: "1px solid rgba(139,92,246,0.2)",
                    }}
                  >
                    /
                  </kbd>
                )}
                {onShuffle && (
                  <button
                    className="rounded-sm p-1.5 text-white/25 transition-all duration-200 hover:bg-violet-500/10 hover:text-violet-400"
                    onClick={onShuffle}
                    aria-label="Pick a random item"
                    title="Shuffle"
                  >
                    <Shuffle className="h-4 w-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <StatusSegmented value={status} onChange={onStatusChange} counts={counts} />

        <SortSelect mediaType={mediaType} value={sort} onChange={onSortChange} />

        <Button
          variant="outline"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn(
            "h-11 w-11 shrink-0 rounded-sm px-0 font-mono sm:w-auto sm:px-3.5",
            showAdvanced || hasActiveFilters
              ? "border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/15"
              : "border-[#16162a] bg-[#0a0a14] hover:bg-[#0d0d1a]",
          )}
          title="Advanced filters"
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" />
          <span className="ml-1.5 hidden sm:inline">filters</span>
          {advancedFilterCount > 0 && (
            <span className="ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-sm bg-violet-500 px-1 text-[11px] font-mono tabular-nums text-white">
              {advancedFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Filter panel */}
      {showAdvanced && (
        <div
          className={cn(
            "overflow-hidden rounded-sm border border-[#16162a]",
            "bg-[#07070d]",
            "shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)]",
            "animate-in fade-in slide-in-from-top-2 duration-200",
          )}
        >
          {/* Panel header — terminal window chrome */}
          <div
            className="flex items-center justify-between border-b border-[#16162a] px-4 py-2.5"
            style={{ background: "#06060d" }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="h-2 w-2 rounded-full bg-[#ef4444]/70" />
                <div className="h-2 w-2 rounded-full bg-[#f59e0b]/70" />
                <div className="h-2 w-2 rounded-full bg-[#22c55e]/70" />
              </div>
              <span className="text-xs font-mono text-violet-400/70">
                <span className="text-violet-400/45 select-none">#</span> filters
              </span>
              {advancedFilterCount > 0 && (
                <span className="rounded-sm border border-violet-500/15 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-mono tabular-nums text-violet-300">
                  {advancedFilterCount} active
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <PresetsMenu
                presets={prefs.presets}
                onApply={(p) => onApplyAll?.(p.snapshot)}
                onDelete={prefs.deletePreset}
                onSave={(name) => prefs.savePreset(name, currentSnapshot)}
                canSave={hasActiveFilters || !!sort}
              />
              {hasActiveFilters && (
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1 text-xs font-mono text-white/40 transition-colors hover:text-violet-400"
                >
                  <X className="h-3 w-3" />
                  clear_all
                </button>
              )}
            </div>
          </div>

          {/* Pills */}
          <div className="flex flex-wrap items-center gap-2 px-4 py-3.5">
            <GenrePill value={genre} genres={genres} onChange={onGenreChange} />

            <YearPill
              yearFrom={yearFrom}
              yearTo={yearTo}
              currentYear={currentYear}
              sliderValue={sliderValue}
              onCommit={handleYearCommit}
              onClear={() => {
                onYearFromChange(undefined);
                onYearToChange(undefined);
              }}
            />

            <WatchedPill
              watchedFrom={watchedFrom}
              watchedTo={watchedTo}
              onFromChange={onWatchedFromChange}
              onToChange={onWatchedToChange}
              onClear={() => {
                onWatchedFromChange("");
                onWatchedToChange("");
              }}
            />

            {onTagIdsChange && tags.length > 0 && (
              <TagsPill tagIds={tagIds} tagOptions={tagOptions} onChange={onTagIdsChange} />
            )}
          </div>

          {/* Status line — vim-style summary of the active query */}
          <div
            className="flex items-center gap-2 border-t border-[#16162a] px-3 py-1.5 font-mono text-[11px]"
            style={{ background: "#06060d" }}
          >
            <span className="shrink-0 rounded-sm bg-violet-600/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              filter
            </span>
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scrollbar-none lowercase">
              {filterTokens.length === 0 ? (
                <span className="text-white/30">no active filters</span>
              ) : (
                filterTokens.map((t) => (
                  <span key={t.key} className="whitespace-nowrap">
                    <span className="text-violet-400/70">{t.key}</span>
                    <span className="text-white/25">=</span>
                    <span className="text-white/70">{t.val}</span>
                  </span>
                ))
              )}
            </div>
            {resultCount !== undefined && (
              <span className="shrink-0 tabular-nums text-white/40">
                {resultCount.toLocaleString()} <span className="text-white/25">results</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Filter pill base styles ──────────────────────────────────────────────────

const PILL_BASE =
  "group inline-flex h-8 items-center gap-1.5 rounded-sm border px-3 text-xs font-mono transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40";

const PILL_IDLE =
  "border-[#16162a] bg-[#0a0a14] text-white/50 hover:border-violet-500/20 hover:bg-[#0d0d1a] hover:text-white/75";

const PILL_ACTIVE =
  "border-violet-500/30 bg-violet-500/10 text-violet-300 hover:border-violet-500/45 hover:bg-violet-500/15";

function PillClear({ onClear }: { onClear: (e: React.MouseEvent) => void }) {
  return (
    <span
      role="button"
      onClick={onClear}
      className="ml-0.5 rounded-sm p-0.5 opacity-60 transition-opacity hover:opacity-100"
      aria-label="Clear filter"
    >
      <X className="h-3 w-3" />
    </span>
  );
}

// ─── Genre pill ───────────────────────────────────────────────────────────────

function GenrePill({
  value,
  genres,
  onChange,
}: {
  value?: string;
  genres: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasValue = !!value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn(PILL_BASE, hasValue ? PILL_ACTIVE : PILL_IDLE)}>
          <Film
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform",
              !hasValue && "group-hover:translate-x-0.5",
            )}
          />
          <span>{hasValue ? value : "genre"}</span>
          {hasValue ? (
            <PillClear
              onClear={(e) => {
                e.stopPropagation();
                onChange("");
              }}
            />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 opacity-40" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-48 p-1.5 max-h-64 overflow-y-auto rounded-sm border-[#16162a] bg-[#07070d]"
      >
        {genres.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => {
              onChange(g);
              setOpen(false);
            }}
            className={cn(
              "w-full rounded-sm px-3 py-1.5 text-left text-xs font-mono transition-colors",
              value === g
                ? "bg-violet-500/10 text-violet-200"
                : "text-white/60 hover:bg-[#0d0d1a] hover:text-white/85",
            )}
          >
            {g}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ─── Year pill ────────────────────────────────────────────────────────────────

function YearPill({
  yearFrom,
  yearTo,
  currentYear,
  sliderValue,
  onCommit,
  onClear,
}: {
  yearFrom?: number;
  yearTo?: number;
  currentYear: number;
  sliderValue: [number, number];
  onCommit: (v: number[]) => void;
  onClear: () => void;
}) {
  const hasValue = !!yearFrom || !!yearTo;
  const label = hasValue
    ? yearFrom === yearTo
      ? `${yearFrom}`
      : `${yearFrom ?? YEAR_MIN}–${yearTo ?? currentYear}`
    : "year";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn(PILL_BASE, hasValue ? PILL_ACTIVE : PILL_IDLE)}>
          <Calendar
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform",
              !hasValue && "group-hover:translate-x-0.5",
            )}
          />
          <span>{label}</span>
          {hasValue ? (
            <PillClear
              onClear={(e) => {
                e.stopPropagation();
                onClear();
              }}
            />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 opacity-40" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 p-4 space-y-4 rounded-sm border-[#16162a] bg-[#07070d]"
      >
        <div className="flex items-center justify-between text-xs font-mono text-violet-400/60">
          <span>release_year</span>
          <span className="tabular-nums text-white/60">
            {sliderValue[0]} – {sliderValue[1]}
          </span>
        </div>
        <Slider
          min={YEAR_MIN}
          max={currentYear}
          step={1}
          value={sliderValue}
          onValueChange={onCommit}
          minStepsBetweenThumbs={0}
        />
        <div className="flex justify-between text-[10px] font-mono text-white/30 tabular-nums">
          <span>{YEAR_MIN}</span>
          <span>{currentYear}</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Watched date pill ────────────────────────────────────────────────────────

function WatchedPill({
  watchedFrom,
  watchedTo,
  onFromChange,
  onToChange,
  onClear,
}: {
  watchedFrom?: string;
  watchedTo?: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onClear: () => void;
}) {
  const hasValue = !!watchedFrom || !!watchedTo;
  const today = format(new Date(), "yyyy-MM-dd");

  let label = "watched";
  if (watchedFrom && watchedTo) label = `${watchedFrom} → ${watchedTo}`;
  else if (watchedFrom) label = `from ${watchedFrom}`;
  else if (watchedTo) label = `until ${watchedTo}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn(PILL_BASE, hasValue ? PILL_ACTIVE : PILL_IDLE)}>
          <CalendarDays
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform",
              !hasValue && "group-hover:translate-x-0.5",
            )}
          />
          <span>{label}</span>
          {hasValue ? (
            <PillClear
              onClear={(e) => {
                e.stopPropagation();
                onClear();
              }}
            />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 opacity-40" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-56 p-4 space-y-3 rounded-sm border-[#16162a] bg-[#07070d]"
      >
        <div className="space-y-1.5">
          <label className="text-xs font-mono text-violet-400/60">from</label>
          <Input
            type="date"
            value={watchedFrom || ""}
            onChange={(e) => onFromChange(e.target.value)}
            max={watchedTo || today}
            className="h-9 font-mono text-xs border-[#16162a]"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-mono text-violet-400/60">to</label>
          <Input
            type="date"
            value={watchedTo || ""}
            onChange={(e) => onToChange(e.target.value)}
            min={watchedFrom}
            max={today}
            className="h-9 font-mono text-xs border-[#16162a]"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Tags pill ────────────────────────────────────────────────────────────────

function TagsPill({
  tagIds,
  tagOptions,
  onChange,
}: {
  tagIds: number[];
  tagOptions: { value: number; label: string; color?: string }[];
  onChange: (ids: number[]) => void;
}) {
  const hasValue = tagIds.length > 0;
  const label = hasValue ? `${tagIds.length} tag${tagIds.length > 1 ? "s" : ""}` : "tags";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn(PILL_BASE, hasValue ? PILL_ACTIVE : PILL_IDLE)}>
          <Tag
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform",
              !hasValue && "group-hover:translate-x-0.5",
            )}
          />
          <span>{label}</span>
          {hasValue ? (
            <PillClear
              onClear={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
            />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 opacity-40" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2 rounded-sm border-[#16162a] bg-[#07070d]">
        <MultiCombobox
          options={tagOptions}
          value={tagIds}
          onChange={onChange}
          placeholder="Search tags..."
          triggerPlaceholder="Select tags..."
        />
      </PopoverContent>
    </Popover>
  );
}

// ─── Presets menu ─────────────────────────────────────────────────────────────

interface PresetsMenuProps {
  presets: FilterPreset[];
  onApply: (preset: FilterPreset) => void;
  onDelete: (id: string) => void;
  onSave: (name: string) => void;
  canSave: boolean;
}

function PresetsMenu({ presets, onApply, onDelete, onSave, canSave }: PresetsMenuProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-white/45 transition-colors hover:text-violet-400"
        >
          <Bookmark className="h-3.5 w-3.5" />
          presets
          {presets.length > 0 && <span className="text-white/30">({presets.length})</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-3 space-y-3 rounded-sm border-[#16162a] bg-[#07070d]"
      >
        <div>
          <div className="mb-2 text-xs font-mono text-violet-400/60">save_as_preset</div>
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSave();
                }
              }}
              placeholder="preset name"
              className="h-9 font-mono text-xs border-[#16162a]"
              disabled={!canSave}
            />
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!canSave || !name.trim()}
              className="h-9"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          {!canSave && (
            <p className="mt-1 text-[10px] font-mono text-white/35">apply some filters to save.</p>
          )}
        </div>

        {presets.length > 0 && (
          <div className="space-y-1 border-t border-[#16162a] pt-3">
            <div className="mb-1 text-xs font-mono text-violet-400/60">saved_presets</div>
            {presets.map((p) => (
              <div
                key={p.id}
                className="group flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-[#0d0d1a]"
              >
                <button
                  type="button"
                  onClick={() => {
                    onApply(p);
                    setOpen(false);
                  }}
                  className="flex-1 truncate text-left text-xs font-mono text-white/70 hover:text-white/90"
                >
                  {p.name}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(p.id)}
                  className="rounded-sm p-1 text-white/30 opacity-0 transition-opacity hover:bg-violet-500/8 hover:text-white/70 group-hover:opacity-100"
                  aria-label={`Delete preset ${p.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
