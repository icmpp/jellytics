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
import { useStatusCounts } from "@/hooks/useStatusCounts";
import { useViewPrefs, type FilterPreset } from "@/hooks/useViewPrefs";
import type { MediaFiltersSnapshot } from "@/hooks/useMediaFilters";
import { useState, useEffect, useMemo } from "react";
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
  const debouncedSearch = useDebounce(searchValue, 300);
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
  const searchPlaceholder = `Search ${label.toLowerCase()}...`;

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

  return (
    <div className="space-y-2">
      {/* Main toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="h-11 pl-10 pr-9"
          />
          {searchValue ? (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-white/40 transition-colors hover:bg-white/8 hover:text-white"
              onClick={() => setSearchValue("")}
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : onShuffle ? (
            <button
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/25 transition-all duration-200 hover:bg-purple-500/10 hover:text-purple-400"
              onClick={onShuffle}
              aria-label="Pick a random item"
              title="Shuffle"
            >
              <Shuffle className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <StatusSegmented value={status} onChange={onStatusChange} counts={counts} />

        <SortSelect mediaType={mediaType} value={sort} onChange={onSortChange} />

        <Button
          variant="outline"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn(
            "h-11 w-11 shrink-0 px-0 sm:w-auto sm:px-3.5",
            (showAdvanced || hasActiveFilters) &&
              "border-purple-500/30 bg-purple-500/10 text-purple-400",
          )}
          title="Advanced filters"
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" />
          <span className="ml-1.5 hidden sm:inline">Filters</span>
          {advancedFilterCount > 0 && (
            <span className="ml-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-purple-500 text-xs font-medium text-white">
              {advancedFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Filter panel */}
      {showAdvanced && (
        <div
          className={cn(
            "overflow-hidden rounded-2xl border border-white/8",
            "bg-white/2 backdrop-blur-md",
            "shadow-[0_4px_24px_-4px_rgba(0,0,0,0.3)]",
            "animate-in fade-in slide-in-from-top-2 duration-200",
          )}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between border-b border-white/6 px-4 py-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-sm font-medium text-white/70">Filters</span>
              {advancedFilterCount > 0 && (
                <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-purple-300">
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
                  className="flex items-center gap-1 text-xs text-white/40 transition-colors hover:text-white"
                >
                  <X className="h-3 w-3" />
                  Clear all
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
        </div>
      )}
    </div>
  );
}

// ─── Filter pill base styles ──────────────────────────────────────────────────

const PILL_BASE =
  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40";

const PILL_IDLE =
  "border-white/8 bg-white/[0.03] text-white/55 hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-white";

const PILL_ACTIVE =
  "border-purple-500/40 bg-purple-500/12 text-purple-300 hover:border-purple-500/55 hover:bg-purple-500/18";

function PillClear({ onClear }: { onClear: (e: React.MouseEvent) => void }) {
  return (
    <span
      role="button"
      onClick={onClear}
      className="ml-0.5 rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100"
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
          <Film className="h-3.5 w-3.5 shrink-0" />
          <span>{hasValue ? value : "Genre"}</span>
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
      <PopoverContent align="start" className="w-48 p-1.5 max-h-64 overflow-y-auto">
        {genres.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => {
              onChange(g);
              setOpen(false);
            }}
            className={cn(
              "w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors",
              value === g
                ? "bg-purple-500/20 text-purple-300"
                : "text-white/70 hover:bg-white/[0.06] hover:text-white",
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
    : "Year";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn(PILL_BASE, hasValue ? PILL_ACTIVE : PILL_IDLE)}>
          <Calendar className="h-3.5 w-3.5 shrink-0" />
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
      <PopoverContent align="start" className="w-64 p-4 space-y-4">
        <div className="flex items-center justify-between text-xs text-white/50">
          <span>Release Year</span>
          <span className="tabular-nums text-white/70">
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
        <div className="flex justify-between text-[10px] text-white/30 tabular-nums">
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

  let label = "Watched";
  if (watchedFrom && watchedTo) label = `${watchedFrom} → ${watchedTo}`;
  else if (watchedFrom) label = `From ${watchedFrom}`;
  else if (watchedTo) label = `Until ${watchedTo}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn(PILL_BASE, hasValue ? PILL_ACTIVE : PILL_IDLE)}>
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
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
      <PopoverContent align="start" className="w-56 p-4 space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs text-white/50">From</label>
          <Input
            type="date"
            value={watchedFrom || ""}
            onChange={(e) => onFromChange(e.target.value)}
            max={watchedTo || today}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-white/50">To</label>
          <Input
            type="date"
            value={watchedTo || ""}
            onChange={(e) => onToChange(e.target.value)}
            min={watchedFrom}
            max={today}
            className="h-9 text-sm"
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
  const label = hasValue ? `${tagIds.length} tag${tagIds.length > 1 ? "s" : ""}` : "Tags";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn(PILL_BASE, hasValue ? PILL_ACTIVE : PILL_IDLE)}>
          <Tag className="h-3.5 w-3.5 shrink-0" />
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
      <PopoverContent align="start" className="w-64 p-2">
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
          className="inline-flex items-center gap-1.5 text-xs text-white/50 transition-colors hover:text-white"
        >
          <Bookmark className="h-3.5 w-3.5" />
          Presets
          {presets.length > 0 && <span className="text-white/30">({presets.length})</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3 space-y-3">
        <div>
          <div className="mb-2 text-xs font-medium text-white/70">Save current as preset</div>
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
              placeholder="Preset name"
              className="h-9 text-sm"
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
            <p className="mt-1 text-[11px] text-white/40">Apply some filters before saving.</p>
          )}
        </div>

        {presets.length > 0 && (
          <div className="space-y-1 border-t border-white/6 pt-3">
            <div className="mb-1 text-xs font-medium text-white/70">Saved presets</div>
            {presets.map((p) => (
              <div
                key={p.id}
                className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/4"
              >
                <button
                  type="button"
                  onClick={() => {
                    onApply(p);
                    setOpen(false);
                  }}
                  className="flex-1 truncate text-left text-sm text-white/80 hover:text-white"
                >
                  {p.name}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(p.id)}
                  className="rounded-md p-1 text-white/30 opacity-0 transition-opacity hover:bg-white/6 hover:text-white/70 group-hover:opacity-100"
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
