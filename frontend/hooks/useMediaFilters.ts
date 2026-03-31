"use client";

import { useState, useMemo } from "react";

export interface MediaFiltersState {
  statusFilter: string;
  searchFilter: string;
  genreFilter: string;
  yearFrom: number | undefined;
  yearTo: number | undefined;
  watchedFrom: string;
  watchedTo: string;
  tagIds: number[];
  setStatusFilter: (v: string) => void;
  setSearchFilter: (v: string) => void;
  setGenreFilter: (v: string) => void;
  setYearFrom: (v: number | undefined) => void;
  setYearTo: (v: number | undefined) => void;
  setWatchedFrom: (v: string) => void;
  setWatchedTo: (v: string) => void;
  setTagIds: (v: number[]) => void;
}

export function useMediaFilters(): MediaFiltersState {
  const [statusFilter, setStatusFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [yearFrom, setYearFrom] = useState<number | undefined>();
  const [yearTo, setYearTo] = useState<number | undefined>();
  const [watchedFrom, setWatchedFrom] = useState("");
  const [watchedTo, setWatchedTo] = useState("");
  const [tagIds, setTagIds] = useState<number[]>([]);

  return useMemo(
    () => ({
      statusFilter,
      searchFilter,
      genreFilter,
      yearFrom,
      yearTo,
      watchedFrom,
      watchedTo,
      tagIds,
      setStatusFilter,
      setSearchFilter,
      setGenreFilter,
      setYearFrom,
      setYearTo,
      setWatchedFrom,
      setWatchedTo,
      setTagIds,
    }),
    [statusFilter, searchFilter, genreFilter, yearFrom, yearTo, watchedFrom, watchedTo, tagIds],
  );
}
