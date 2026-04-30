"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MediaFiltersSnapshot } from "@/hooks/useMediaFilters";

/** A named saved filter + sort snapshot. */
export interface FilterPreset {
  id: string;
  name: string;
  snapshot: Partial<MediaFiltersSnapshot>;
  createdAt: string;
}

export type Density = "sm" | "md" | "lg";

export interface ViewPrefsState {
  /** Default sort key for new pages that don't specify one in the URL. */
  defaultSort: string;
  setDefaultSort: (v: string) => void;
  density: Density;
  setDensity: (v: Density) => void;
  presets: FilterPreset[];
  savePreset: (name: string, snapshot: Partial<MediaFiltersSnapshot>) => FilterPreset;
  deletePreset: (id: string) => void;
}

interface Stored {
  defaultSort?: string;
  density?: Density;
  presets?: FilterPreset[];
}

function storageKey(scope: string) {
  return `jellytics.viewPrefs.${scope}`;
}

function readStored(scope: string): Stored {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey(scope));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Stored;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStored(scope: string, value: Stored) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(scope), JSON.stringify(value));
  } catch {
    // Ignore quota / private mode failures – prefs are best-effort.
  }
}

/**
 * Per-scope (e.g. "movies" or "shows") view preferences persisted in
 * localStorage. SSR-safe: the initial render returns empty defaults and the
 * stored values are hydrated inside an effect so server/client markup match.
 */
export function useViewPrefs(scope: "movies" | "shows"): ViewPrefsState {
  const [stored, setStored] = useState<Stored>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional post-mount localStorage hydration
    setStored(readStored(scope));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pairs with the hydration above
    setHydrated(true);
  }, [scope]);

  useEffect(() => {
    if (!hydrated) return;
    writeStored(scope, stored);
  }, [scope, stored, hydrated]);

  const setDefaultSort = useCallback((v: string) => {
    setStored((s) => ({ ...s, defaultSort: v || undefined }));
  }, []);

  const setDensity = useCallback((v: Density) => {
    setStored((s) => ({ ...s, density: v }));
  }, []);

  const savePreset = useCallback(
    (name: string, snapshot: Partial<MediaFiltersSnapshot>): FilterPreset => {
      const preset: FilterPreset = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: name.trim() || "Untitled preset",
        snapshot,
        createdAt: new Date().toISOString(),
      };
      setStored((s) => ({
        ...s,
        presets: [...(s.presets ?? []), preset],
      }));
      return preset;
    },
    [],
  );

  const deletePreset = useCallback((id: string) => {
    setStored((s) => ({
      ...s,
      presets: (s.presets ?? []).filter((p) => p.id !== id),
    }));
  }, []);

  return useMemo(
    () => ({
      defaultSort: stored.defaultSort ?? "",
      setDefaultSort,
      density: stored.density ?? "md",
      setDensity,
      presets: stored.presets ?? [],
      savePreset,
      deletePreset,
    }),
    [stored, setDefaultSort, setDensity, savePreset, deletePreset],
  );
}
