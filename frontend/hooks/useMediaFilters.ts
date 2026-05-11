"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface MediaFiltersState {
  statusFilter: string;
  searchFilter: string;
  genreFilter: string;
  yearFrom: number | undefined;
  yearTo: number | undefined;
  watchedFrom: string;
  watchedTo: string;
  tagIds: number[];
  sort: string;
  setStatusFilter: (v: string) => void;
  setSearchFilter: (v: string) => void;
  setGenreFilter: (v: string) => void;
  setYearFrom: (v: number | undefined) => void;
  setYearTo: (v: number | undefined) => void;
  setWatchedFrom: (v: string) => void;
  setWatchedTo: (v: string) => void;
  setTagIds: (v: number[]) => void;
  setSort: (v: string) => void;
  applyAll: (snapshot: Partial<MediaFiltersSnapshot>) => void;
}

export interface MediaFiltersSnapshot {
  status: string;
  search: string;
  genre: string;
  yearFrom: number | undefined;
  yearTo: number | undefined;
  watchedFrom: string;
  watchedTo: string;
  tagIds: number[];
  sort: string;
}

/** Parse tag IDs from a comma-separated URL param ("1,2,3"). */
function parseTagIDs(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function parseYear(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function readFromParams(sp: URLSearchParams): MediaFiltersSnapshot {
  return {
    status: sp.get("status") ?? "",
    search: sp.get("search") ?? "",
    genre: sp.get("genre") ?? "",
    yearFrom: parseYear(sp.get("year_from")),
    yearTo: parseYear(sp.get("year_to")),
    watchedFrom: sp.get("watched_from") ?? "",
    watchedTo: sp.get("watched_to") ?? "",
    tagIds: parseTagIDs(sp.get("tags")),
    sort: sp.get("sort") ?? "",
  };
}

function toParams(snap: MediaFiltersSnapshot): URLSearchParams {
  const sp = new URLSearchParams();
  if (snap.status) sp.set("status", snap.status);
  if (snap.search) sp.set("search", snap.search);
  if (snap.genre) sp.set("genre", snap.genre);
  if (snap.yearFrom !== undefined) sp.set("year_from", String(snap.yearFrom));
  if (snap.yearTo !== undefined) sp.set("year_to", String(snap.yearTo));
  if (snap.watchedFrom) sp.set("watched_from", snap.watchedFrom);
  if (snap.watchedTo) sp.set("watched_to", snap.watchedTo);
  if (snap.tagIds.length > 0) sp.set("tags", snap.tagIds.join(","));
  if (snap.sort) sp.set("sort", snap.sort);
  return sp;
}

/**
 * Filter state synchronised with the URL query string. Updates are debounced
 * so that fast-changing inputs (like the search field) don't spam the browser
 * history. `router.replace` is used so that we don't push a new history entry
 * on every keystroke.
 */
export function useMediaFilters(): MediaFiltersState {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initial = useMemo(
    () => readFromParams(new URLSearchParams(searchParams?.toString() ?? "")),
    // Only parse on first render; subsequent URL changes are reflected via the
    // syncRef effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [snap, setSnap] = useState<MediaFiltersSnapshot>(initial);

  // Reflect back→forward/browser-driven URL changes into local state.
  const lastSerialisedRef = useRef<string>(toParams(initial).toString());
  useEffect(() => {
    const current = searchParams?.toString() ?? "";
    if (current === lastSerialisedRef.current) return;
    lastSerialisedRef.current = current;
    setSnap(readFromParams(new URLSearchParams(current)));
  }, [searchParams]);

  // Debounced write to the URL.
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const serialised = toParams(snap).toString();
    if (serialised === lastSerialisedRef.current) return;

    if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    writeTimerRef.current = setTimeout(() => {
      lastSerialisedRef.current = serialised;
      const href = serialised ? `${pathname}?${serialised}` : pathname;
      router.replace(href, { scroll: false });
    }, 150);

    return () => {
      if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    };
  }, [snap, pathname, router]);

  const setStatusFilter = useCallback((v: string) => setSnap((s) => ({ ...s, status: v })), []);
  const setSearchFilter = useCallback((v: string) => setSnap((s) => ({ ...s, search: v })), []);
  const setGenreFilter = useCallback((v: string) => setSnap((s) => ({ ...s, genre: v })), []);
  const setYearFrom = useCallback(
    (v: number | undefined) => setSnap((s) => ({ ...s, yearFrom: v })),
    [],
  );
  const setYearTo = useCallback(
    (v: number | undefined) => setSnap((s) => ({ ...s, yearTo: v })),
    [],
  );
  const setWatchedFrom = useCallback((v: string) => setSnap((s) => ({ ...s, watchedFrom: v })), []);
  const setWatchedTo = useCallback((v: string) => setSnap((s) => ({ ...s, watchedTo: v })), []);
  const setTagIds = useCallback((v: number[]) => setSnap((s) => ({ ...s, tagIds: v })), []);
  const setSort = useCallback((v: string) => setSnap((s) => ({ ...s, sort: v })), []);

  const applyAll = useCallback((partial: Partial<MediaFiltersSnapshot>) => {
    setSnap((s) => ({ ...s, ...partial }));
  }, []);

  return useMemo(
    () => ({
      statusFilter: snap.status,
      searchFilter: snap.search,
      genreFilter: snap.genre,
      yearFrom: snap.yearFrom,
      yearTo: snap.yearTo,
      watchedFrom: snap.watchedFrom,
      watchedTo: snap.watchedTo,
      tagIds: snap.tagIds,
      sort: snap.sort,
      setStatusFilter,
      setSearchFilter,
      setGenreFilter,
      setYearFrom,
      setYearTo,
      setWatchedFrom,
      setWatchedTo,
      setTagIds,
      setSort,
      applyAll,
    }),
    [
      snap,
      setStatusFilter,
      setSearchFilter,
      setGenreFilter,
      setYearFrom,
      setYearTo,
      setWatchedFrom,
      setWatchedTo,
      setTagIds,
      setSort,
      applyAll,
    ],
  );
}
