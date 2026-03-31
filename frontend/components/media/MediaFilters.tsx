"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, SlidersHorizontal, Calendar, Film, CalendarDays, Tag } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { useTags } from "@/hooks/useTags";
import { useGenres } from "@/hooks/useGenres";
import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";

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
  onStatusChange: (status: string) => void;
  onSearchChange: (search: string) => void;
  onGenreChange: (genre: string) => void;
  onYearFromChange: (year: number | undefined) => void;
  onYearToChange: (year: number | undefined) => void;
  onWatchedFromChange: (date: string) => void;
  onWatchedToChange: (date: string) => void;
  onTagIdsChange?: (tagIds: number[]) => void;
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
  onStatusChange,
  onSearchChange,
  onGenreChange,
  onYearFromChange,
  onYearToChange,
  onWatchedFromChange,
  onWatchedToChange,
  onTagIdsChange,
}: MediaFiltersProps) {
  const [searchValue, setSearchValue] = useState(search);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const debouncedSearch = useDebounce(searchValue, 300);
  const genres = useGenres(mediaType);
  const { data: tags = [] } = useTags();
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: currentYear - 1950 + 1 }, (_, i) => currentYear - i);
  }, []);

  const label = mediaType === "movies" ? "Movies" : "Shows";
  const searchPlaceholder = `Search ${label.toLowerCase()}...`;

  useEffect(() => {
    onSearchChange(debouncedSearch);
  }, [debouncedSearch, onSearchChange]);

  const hasActiveFilters =
    genre || yearFrom || yearTo || watchedFrom || watchedTo || tagIds.length > 0;
  const activeFilterCount = [
    genre,
    yearFrom,
    yearTo,
    watchedFrom,
    watchedTo,
    tagIds.length > 0,
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-11 h-11"
          />
          {searchValue && (
            <button
              className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.08] transition-colors"
              onClick={() => setSearchValue("")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Select
          value={status || "all"}
          onValueChange={(value) => onStatusChange(value === "all" ? "" : value)}
        >
          <SelectTrigger className="w-full sm:w-[160px] h-11">
            <SelectValue placeholder={`All ${label}`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All {label}</SelectItem>
            <SelectItem value="watched">Watched</SelectItem>
            <SelectItem value="watching">Watching</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`h-11 px-4 ${hasActiveFilters ? "border-purple-500/30 bg-purple-500/10 text-purple-400" : ""}`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="ml-2">Filters</span>
          {activeFilterCount > 0 && (
            <span className="ml-2 h-5 w-5 rounded-full bg-purple-500 text-white text-xs flex items-center justify-center font-medium">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {showAdvanced && (
        <div className="rounded-2xl backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-purple-400" />
              Advanced Filters
            </h3>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  onGenreChange("");
                  onYearFromChange(undefined);
                  onYearToChange(undefined);
                  onWatchedFromChange("");
                  onWatchedToChange("");
                  onTagIdsChange?.([]);
                }}
                className="text-xs text-white/40 hover:text-white flex items-center gap-1.5 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Clear all
              </button>
            )}
          </div>

          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              <div className="space-y-2.5">
                <label className="text-sm font-medium text-white/60 flex items-center gap-2">
                  <Film className="h-4 w-4" />
                  Genre
                </label>
                <Select
                  value={genre || "all"}
                  onValueChange={(value) => onGenreChange(value === "all" ? "" : value)}
                >
                  <SelectTrigger className="w-full h-11">
                    <SelectValue placeholder="All Genres" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Genres</SelectItem>
                    {genres.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2.5">
                <label className="text-sm font-medium text-white/60 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Release Year
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select
                    value={yearFrom?.toString() || "all"}
                    onValueChange={(value) =>
                      onYearFromChange(value === "all" ? undefined : parseInt(value))
                    }
                  >
                    <SelectTrigger className="flex-1 h-11">
                      <SelectValue placeholder="From" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any</SelectItem>
                      {years.map((y) => (
                        <SelectItem key={y} value={y.toString()}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="flex items-center text-white/30">–</span>
                  <Select
                    value={yearTo?.toString() || "all"}
                    onValueChange={(value) =>
                      onYearToChange(value === "all" ? undefined : parseInt(value))
                    }
                  >
                    <SelectTrigger className="flex-1 h-11">
                      <SelectValue placeholder="To" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any</SelectItem>
                      {years.map((y) => (
                        <SelectItem key={y} value={y.toString()}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2.5">
                <label className="text-sm font-medium text-white/60 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Watched Date
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    type="date"
                    value={watchedFrom || ""}
                    onChange={(e) => onWatchedFromChange(e.target.value)}
                    max={watchedTo || format(new Date(), "yyyy-MM-dd")}
                    className="flex-1 h-11"
                  />
                  <span className="flex items-center text-white/30">–</span>
                  <Input
                    type="date"
                    value={watchedTo || ""}
                    onChange={(e) => onWatchedToChange(e.target.value)}
                    min={watchedFrom}
                    max={format(new Date(), "yyyy-MM-dd")}
                    className="flex-1 h-11"
                  />
                </div>
              </div>

              {onTagIdsChange && tags.length > 0 && (
                <div className="space-y-2.5 md:col-span-3">
                  <label className="text-sm font-medium text-white/60 flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((t) => {
                      const isSelected = tagIds.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              onTagIdsChange(tagIds.filter((id) => id !== t.id));
                            } else {
                              onTagIdsChange([...tagIds, t.id]);
                            }
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                            isSelected
                              ? "border-purple-500/50 bg-purple-500/20 text-purple-300"
                              : "border-white/20 bg-white/[0.04] text-white/60 hover:bg-white/[0.08]"
                          }`}
                          style={isSelected ? {} : { borderColor: `${t.color}40`, color: t.color }}
                        >
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
