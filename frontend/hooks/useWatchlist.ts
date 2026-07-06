"use client";

import React, { useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "@/hooks/useToast";
import { ToastAction } from "@/components/ui/toast";

export interface WatchlistItem {
  id: number;
  item_type: "show" | "movie";
  item_id: number;
  jellyfin_id?: string;
  title: string;
  poster_url?: string;
  added_at: string;
}

interface WatchlistResponse {
  items: WatchlistItem[];
  total: number;
}

export function useWatchlist() {
  return useQuery<WatchlistResponse>({
    queryKey: ["watchlist"],
    queryFn: async () => {
      try {
        return await api.get<WatchlistResponse>("/watchlist");
      } catch (err) {
        console.warn("Failed to fetch watchlist:", err);
        return { items: [], total: 0 };
      }
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useAddToWatchlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemType, itemId }: { itemType: "show" | "movie"; itemId: number }) => {
      return api.post<WatchlistItem>("/watchlist", {
        item_type: itemType,
        item_id: itemId,
      });
    },
    onMutate: async ({ itemType, itemId }) => {
      await queryClient.cancelQueries({ queryKey: ["watchlist"] });
      const previousWatchlist = queryClient.getQueryData<WatchlistResponse>(["watchlist"]);

      const tempId = -Date.now(); // negative temp ID to replace on success
      const optimisticItem: WatchlistItem = {
        id: tempId,
        item_type: itemType,
        item_id: itemId,
        title: "Loading...",
        added_at: new Date().toISOString(),
      };

      const currentItems = previousWatchlist?.items ?? [];
      const currentTotal = previousWatchlist?.total ?? 0;

      queryClient.setQueryData<WatchlistResponse>(["watchlist"], {
        items: [optimisticItem, ...currentItems],
        total: currentTotal + 1,
      });

      return { previousWatchlist, tempId };
    },
    onSuccess: (data, _variables, context) => {
      const { tempId } = context ?? {};
      const currentWatchlist = queryClient.getQueryData<WatchlistResponse>(["watchlist"]);
      if (currentWatchlist && typeof tempId === "number") {
        const items = currentWatchlist.items.map((item) => (item.id === tempId ? data : item));
        queryClient.setQueryData<WatchlistResponse>(["watchlist"], {
          items,
          total: items.length,
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      }

      toast.success({
        title: "Added to watchlist",
        description: `${data.title} has been added to your watchlist.`,
      });
    },
    onError: (error, variables, context) => {
      if (context?.previousWatchlist) {
        queryClient.setQueryData<WatchlistResponse>(["watchlist"], context.previousWatchlist);
      }
      console.error("Failed to add to watchlist:", error);
      toast.error({
        title: "Error",
        description: "Failed to add item to watchlist. Please try again.",
      });
    },
  });
}

export function useRemoveFromWatchlist() {
  const queryClient = useQueryClient();

  // Row id resolved in onMutate (while the cache is still intact) and read back in
  // mutationFn — onMutate runs first and optimistically removes the item, so mutationFn
  // can no longer look it up by item_type/item_id.
  const resolvedIdRef = useRef<number | null>(null);

  // Re-add a just-removed item (optimistically) for the toast's Undo action.
  const restoreItem = async (item: WatchlistItem) => {
    await queryClient.cancelQueries({ queryKey: ["watchlist"] });
    const previous = queryClient.getQueryData<WatchlistResponse>(["watchlist"]);

    queryClient.setQueryData<WatchlistResponse>(["watchlist"], {
      items: [item, ...(previous?.items ?? [])],
      total: (previous?.total ?? 0) + 1,
    });

    try {
      await api.post("/watchlist", { item_type: item.item_type, item_id: item.item_id });
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    } catch (error) {
      console.error("Failed to restore watchlist item:", error);
      queryClient.setQueryData<WatchlistResponse>(["watchlist"], previous);
      toast.error({
        title: "Error",
        description: "Failed to restore item. Please try again.",
      });
    }
  };

  return useMutation({
    mutationFn: async (variables: number | { itemType: "show" | "movie"; itemId: number }) => {
      // For the object form, onMutate has already resolved the row id (the cache
      // entry it would need is removed optimistically before mutationFn runs).
      const watchlistItemId = typeof variables === "number" ? variables : resolvedIdRef.current;

      if (watchlistItemId === null) {
        throw new Error("Item not found in watchlist");
      }

      return api.delete(`/watchlist/${watchlistItemId}`);
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["watchlist"] });
      const previousWatchlist = queryClient.getQueryData<WatchlistResponse>(["watchlist"]);

      let itemTitle = "Item";
      let itemToRemove: WatchlistItem | undefined;

      if (typeof variables === "number") {
        itemToRemove = previousWatchlist?.items.find((item) => item.id === variables);
      } else {
        itemToRemove = previousWatchlist?.items.find(
          (item) => item.item_type === variables.itemType && item.item_id === variables.itemId,
        );
      }

      // Hand the resolved row id to mutationFn before the cache entry is dropped below.
      resolvedIdRef.current = itemToRemove?.id ?? null;

      if (itemToRemove) {
        itemTitle = itemToRemove.title;

        if (previousWatchlist) {
          queryClient.setQueryData<WatchlistResponse>(["watchlist"], {
            items: previousWatchlist.items.filter((item) =>
              typeof variables === "number"
                ? item.id !== variables
                : !(item.item_type === variables.itemType && item.item_id === variables.itemId),
            ),
            total: previousWatchlist.total - 1,
          });
        }
      }

      return { previousWatchlist, itemTitle, removedItem: itemToRemove };
    },
    onSuccess: (_, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });

      const removed = context?.removedItem;
      toast.success({
        title: "Removed from watchlist",
        description: `${context?.itemTitle || "Item"} has been removed from your watchlist.`,
        action: removed
          ? React.createElement(
              ToastAction,
              { altText: "Undo removal", onClick: () => restoreItem(removed) },
              "Undo",
            )
          : undefined,
      });
    },
    onError: (error, variables, context) => {
      if (context?.previousWatchlist) {
        queryClient.setQueryData<WatchlistResponse>(["watchlist"], context.previousWatchlist);
      }
      console.error("Failed to remove from watchlist:", error);
      toast.error({
        title: "Error",
        description: "Failed to remove item from watchlist. Please try again.",
      });
    },
  });
}

export function useIsInWatchlist(itemType: "show" | "movie", itemId: number) {
  const { data } = useWatchlist();

  return useMemo(
    () =>
      (data?.items ?? []).some((item) => item.item_type === itemType && item.item_id === itemId),
    [data?.items, itemType, itemId],
  );
}
