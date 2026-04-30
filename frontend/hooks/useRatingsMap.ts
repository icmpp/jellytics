"use client";

import { useMemo } from "react";
import { useRatingsList } from "@/hooks/useRatings";

/**
 * Returns a Map keyed on `${itemType}:${itemId}` → rating value. Fetched once
 * per page and consulted by each card; avoids N individual rating queries.
 */
export function useRatingsMap() {
  const { data } = useRatingsList();

  return useMemo(() => {
    const map = new Map<string, number>();
    for (const r of data ?? []) {
      map.set(`${r.item_type}:${r.item_id}`, r.rating);
    }
    return map;
  }, [data]);
}

export function ratingKey(itemType: "movie" | "show", itemId: number): string {
  return `${itemType}:${itemId}`;
}
