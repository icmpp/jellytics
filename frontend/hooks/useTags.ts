"use client";

import {
	useQuery,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "@/hooks/useToast";

export interface Tag {
	id: number;
	name: string;
	color: string;
	createdAt: string;
}

export function useTags() {
	return useQuery<Tag[]>({
		queryKey: ["tags"],
		queryFn: async () => {
			const data = await api.get<Tag[]>("/tags");
			return data ?? [];
		},
		staleTime: 2 * 60 * 1000,
		gcTime: 5 * 60 * 1000,
	});
}

export function useTagsForItem(
	itemType: "movie" | "show",
	itemId: number | undefined,
) {
	return useQuery<Tag[]>({
		queryKey: ["tags", "for-item", itemType, itemId],
		queryFn: async () => {
			if (!itemId || itemId <= 0) return [];
			const data = await api.get<Tag[]>(
				`/tags/for-item?item_type=${itemType}&item_id=${itemId}`,
			);
			return data ?? [];
		},
		enabled: !!itemId && itemId > 0,
		staleTime: 60 * 1000,
		gcTime: 2 * 60 * 1000,
	});
}

export function useCreateTag() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			name,
			color,
		}: {
			name: string;
			color?: string;
		}) => {
			const data = await api.post<Tag>("/tags", {
				name: name.trim(),
				color: color || "#6366f1",
			});
			if (!data) throw new Error("Failed to create tag");
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["tags"] });
			toast.success({
				title: "Tag created",
				description: "Your tag has been created.",
			});
		},
		onError: () => {
			toast.error({
				title: "Error",
				description: "Failed to create tag. Please try again.",
			});
		},
	});
}

export function useUpdateTag() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			id,
			name,
			color,
		}: {
			id: number;
			name?: string;
			color?: string;
		}) => {
			await api.put(`/tags/${id}`, {
				name: name ?? undefined,
				color: color ?? undefined,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["tags"] });
			toast.success({
				title: "Tag updated",
				description: "Your tag has been updated.",
			});
		},
		onError: () => {
			toast.error({
				title: "Error",
				description: "Failed to update tag. Please try again.",
			});
		},
	});
}

export function useDeleteTag() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (id: number) => {
			await api.delete(`/tags/${id}`);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["tags"] });
			toast.success({
				title: "Tag deleted",
				description: "The tag has been deleted.",
			});
		},
		onError: () => {
			toast.error({
				title: "Error",
				description: "Failed to delete tag. Please try again.",
			});
		},
	});
}

export function useAddTagToItem() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			tagId,
			itemType,
			itemId,
		}: {
			tagId: number;
			itemType: "movie" | "show";
			itemId: number;
		}) => {
			await api.post(`/tags/${tagId}/items`, {
				item_type: itemType,
				item_id: itemId,
			});
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: ["tags"] });
			queryClient.invalidateQueries({
				queryKey: ["tags", "for-item", variables.itemType, variables.itemId],
			});
			toast.success({
				title: "Tag added",
				description: "The tag has been added to the item.",
			});
		},
		onError: () => {
			toast.error({
				title: "Error",
				description: "Failed to add tag. Please try again.",
			});
		},
	});
}

export function useRemoveTagFromItem() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			tagId,
			itemType,
			itemId,
		}: {
			tagId: number;
			itemType: "movie" | "show";
			itemId: number;
		}) => {
			await api.delete(
				`/tags/${tagId}/items/${itemType}/${itemId}`,
			);
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: ["tags"] });
			queryClient.invalidateQueries({
				queryKey: ["tags", "for-item", variables.itemType, variables.itemId],
			});
			toast.success({
				title: "Tag removed",
				description: "The tag has been removed from the item.",
			});
		},
		onError: () => {
			toast.error({
				title: "Error",
				description: "Failed to remove tag. Please try again.",
			});
		},
	});
}
