"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "@/hooks/useToast";

export interface Review {
  id: number;
  item_type: "show" | "movie";
  item_id: number;
  review_text: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export function useReviewsList() {
  return useQuery<Review[]>({
    queryKey: ["reviews", "list"],
    queryFn: () => api.get<Review[]>("/reviews"),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useReview(itemType: "show" | "movie", itemId: number) {
  return useQuery<Review | null>({
    queryKey: ["review", itemType, itemId],
    queryFn: async () => {
      try {
        return await api.get<Review>(`/reviews/${itemType}/${itemId}`);
      } catch (err) {
        console.warn("Failed to fetch review:", err);
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useCreateOrUpdateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemType,
      itemId,
      reviewText,
      notes,
    }: {
      itemType: "show" | "movie";
      itemId: number;
      reviewText: string;
      notes?: string;
    }) => {
      return api.post<Review>("/reviews", {
        item_type: itemType,
        item_id: itemId,
        review_text: reviewText,
        notes,
      });
    },
    onMutate: async ({ itemType, itemId, reviewText, notes }) => {
      await queryClient.cancelQueries({
        queryKey: ["review", itemType, itemId],
      });
      const previousReview = queryClient.getQueryData<Review>(["review", itemType, itemId]);

      const optimisticReview: Review = {
        id: previousReview?.id ?? Date.now(),
        item_type: itemType,
        item_id: itemId,
        review_text: reviewText,
        notes: notes,
        created_at: previousReview?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      queryClient.setQueryData(["review", itemType, itemId], optimisticReview);

      return { previousReview };
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["review", variables.itemType, variables.itemId], data);
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      toast.success({
        title: "Review saved",
        description: `Your ${variables.itemType === "show" ? "show" : "movie"} review has been saved.`,
      });
    },
    onError: (error, variables, context) => {
      if (context?.previousReview !== undefined) {
        queryClient.setQueryData(
          ["review", variables.itemType, variables.itemId],
          context.previousReview ?? null,
        );
      }
      console.error("Failed to save review:", error);
      toast.error({
        title: "Error",
        description: "Failed to save review. Please try again.",
      });
    },
  });
}

export function useDeleteReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemType, itemId }: { itemType: "show" | "movie"; itemId: number }) => {
      return api.delete(`/reviews/${itemType}/${itemId}`);
    },
    onMutate: async ({ itemType, itemId }) => {
      await queryClient.cancelQueries({
        queryKey: ["review", itemType, itemId],
      });
      const previousReview = queryClient.getQueryData<Review>(["review", itemType, itemId]);
      queryClient.setQueryData(["review", itemType, itemId], null);

      return { previousReview };
    },
    onSuccess: (_, variables) => {
      queryClient.setQueryData(["review", variables.itemType, variables.itemId], null);
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      toast.success({
        title: "Review deleted",
        description: `Your ${variables.itemType === "show" ? "show" : "movie"} review has been deleted.`,
      });
    },
    onError: (error, variables, context) => {
      if (context?.previousReview) {
        queryClient.setQueryData(
          ["review", variables.itemType, variables.itemId],
          context.previousReview,
        );
      }
      console.error("Failed to delete review:", error);
      toast.error({
        title: "Error",
        description: "Failed to delete review. Please try again.",
      });
    },
  });
}
