"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "@/hooks/useToast";

export interface Rating {
  id: number;
  item_type: "show" | "movie";
  item_id: number;
  rating: number; // 1-5 or 1-10
  rated_at: string;
}

export function useRatingsList() {
  return useQuery<Rating[]>({
    queryKey: ["ratings", "list"],
    queryFn: () => api.get<Rating[]>("/ratings"),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useRating(itemType: "show" | "movie", itemId: number) {
  return useQuery<Rating | null>({
    queryKey: ["rating", itemType, itemId],
    queryFn: async () => {
      try {
        return await api.get<Rating>(`/ratings/${itemType}/${itemId}`);
      } catch (err) {
        console.warn("Failed to fetch rating:", err)
        return null
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useSetRating() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemType,
      itemId,
      rating,
    }: {
      itemType: "show" | "movie";
      itemId: number;
      rating: number;
    }) => {
      return api.post<Rating>("/ratings", {
        item_type: itemType,
        item_id: itemId,
        rating,
      });
    },
    onMutate: async ({ itemType, itemId, rating }) => {
      await queryClient.cancelQueries({
        queryKey: ["rating", itemType, itemId],
      });
      const previousRating = queryClient.getQueryData<Rating>([
        "rating",
        itemType,
        itemId,
      ]);

      const optimisticRating: Rating = {
        id: previousRating?.id ?? Date.now(),
        item_type: itemType,
        item_id: itemId,
        rating,
        rated_at: new Date().toISOString(),
      };

      queryClient.setQueryData(["rating", itemType, itemId], optimisticRating);

      return { previousRating };
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(
        ["rating", variables.itemType, variables.itemId],
        data,
      );
      queryClient.invalidateQueries({ queryKey: ["ratings"] });
      toast.success({
        title: "Rating saved",
        description: `Your ${variables.itemType === "show" ? "show" : "movie"} rating has been saved.`,
      });
    },
    onError: (error, variables, context) => {
      if (context?.previousRating !== undefined) {
        queryClient.setQueryData(
          ["rating", variables.itemType, variables.itemId],
          context.previousRating ?? null,
        );
      }
      console.error("Failed to save rating:", error);
      toast.error({
        title: "Error",
        description: "Failed to save rating. Please try again.",
      });
    },
  });
}

export function useDeleteRating() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemType,
      itemId,
    }: {
      itemType: "show" | "movie";
      itemId: number;
    }) => {
      return api.delete(`/ratings/${itemType}/${itemId}`);
    },
    onMutate: async ({ itemType, itemId }) => {
      await queryClient.cancelQueries({
        queryKey: ["rating", itemType, itemId],
      });
      const previousRating = queryClient.getQueryData<Rating>([
        "rating",
        itemType,
        itemId,
      ]);
      queryClient.setQueryData(["rating", itemType, itemId], null);

      return { previousRating };
    },
    onSuccess: (_, variables) => {
      queryClient.setQueryData(
        ["rating", variables.itemType, variables.itemId],
        null,
      );
      queryClient.invalidateQueries({ queryKey: ["ratings"] });
      toast.success({
        title: "Rating removed",
        description: `Your ${variables.itemType === "show" ? "show" : "movie"} rating has been removed.`,
      });
    },
    onError: (error, variables, context) => {
      if (context?.previousRating) {
        queryClient.setQueryData(
          ["rating", variables.itemType, variables.itemId],
          context.previousRating,
        );
      }
      console.error("Failed to remove rating:", error);
      toast.error({
        title: "Error",
        description: "Failed to remove rating. Please try again.",
      });
    },
  });
}
