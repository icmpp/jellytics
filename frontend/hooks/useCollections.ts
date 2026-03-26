"use client";

import {
	useQuery,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "@/hooks/useToast";

export interface Collection {
	id: number;
	name: string;
	description?: string;
	itemCount: number;
	createdAt: string;
}

export interface CollectionListItem extends Collection {
	hasItem?: boolean;
}

export interface CollectionItem {
	itemType: "movie" | "show";
	itemId: number;
	title?: string;
	posterUrl?: string;
}

export interface CollectionWithItems extends Collection {
	items: CollectionItem[];
}

function buildListUrl(itemType?: "movie" | "show", itemId?: number): string {
	const base = "/collections";
	if (itemType && itemId && itemId > 0) {
		return `${base}?item_type=${itemType}&item_id=${itemId}`;
	}
	return base;
}

export function useCollections() {
	return useQuery<Collection[]>({
		queryKey: ["collections"],
		queryFn: async () => {
			const data = await api.get<Collection[]>(buildListUrl());
			return data ?? [];
		},
		staleTime: 2 * 60 * 1000,
		gcTime: 5 * 60 * 1000,
	});
}

export function useCollectionsForItem(
	itemType: "movie" | "show",
	itemId: number | undefined,
) {
	return useQuery<CollectionListItem[]>({
		queryKey: ["collections", "for-item", itemType, itemId],
		queryFn: async () => {
			if (!itemId || itemId <= 0) return [];
			const data = await api.get<CollectionListItem[]>(
				buildListUrl(itemType, itemId),
			);
			return data ?? [];
		},
		enabled: !!itemId && itemId > 0,
		staleTime: 60 * 1000,
		gcTime: 2 * 60 * 1000,
	});
}

export function useCollection(id: number | null) {
	return useQuery<CollectionWithItems>({
		queryKey: ["collections", id],
		queryFn: async () => {
			if (!id) throw new Error("Collection ID required");
			const data = await api.get<CollectionWithItems>(`/collections/${id}`);
			if (!data) throw new Error("Collection not found");
			return data;
		},
		enabled: !!id && id > 0,
		staleTime: 60 * 1000,
		gcTime: 2 * 60 * 1000,
	});
}

export function useCreateCollection() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			name,
			description,
		}: {
			name: string;
			description?: string;
		}) => {
			const data = await api.post<Collection>("/collections", {
				name,
				description: description || "",
			});
			if (!data) throw new Error("Failed to create collection");
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["collections"] });
			toast.success({
				title: "Collection created",
				description: "Your collection has been created.",
			});
		},
		onError: () => {
			toast.error({
				title: "Error",
				description: "Failed to create collection. Please try again.",
			});
		},
	});
}

export function useUpdateCollection() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			id,
			name,
			description,
		}: {
			id: number;
			name?: string;
			description?: string;
		}) => {
			await api.put(`/collections/${id}`, {
				name: name ?? undefined,
				description: description ?? undefined,
			});
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: ["collections"] });
			queryClient.invalidateQueries({
				queryKey: ["collections", variables.id],
			});
			toast.success({
				title: "Collection updated",
				description: "Your collection has been updated.",
			});
		},
		onError: () => {
			toast.error({
				title: "Error",
				description: "Failed to update collection. Please try again.",
			});
		},
	});
}

export function useDeleteCollection() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (id: number) => {
			await api.delete(`/collections/${id}`);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["collections"] });
			toast.success({
				title: "Collection deleted",
				description: "The collection has been deleted.",
			});
		},
		onError: () => {
			toast.error({
				title: "Error",
				description: "Failed to delete collection. Please try again.",
			});
		},
	});
}

export function useAddToCollection() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			collectionId,
			itemType,
			itemId,
		}: {
			collectionId: number;
			itemType: "movie" | "show";
			itemId: number;
		}) => {
			await api.post(`/collections/${collectionId}/items`, {
				item_type: itemType,
				item_id: itemId,
			});
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: ["collections"] });
			queryClient.invalidateQueries({
				queryKey: [
					"collections",
					"for-item",
					variables.itemType,
					variables.itemId,
				],
			});
			queryClient.invalidateQueries({
				queryKey: ["collections", variables.collectionId],
			});
			toast.success({
				title: "Added to collection",
				description: "The item has been added to the collection.",
			});
		},
		onError: () => {
			toast.error({
				title: "Error",
				description: "Failed to add item to collection. Please try again.",
			});
		},
	});
}

export function useRemoveFromCollection() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			collectionId,
			itemType,
			itemId,
		}: {
			collectionId: number;
			itemType: "movie" | "show";
			itemId: number;
		}) => {
			await api.delete(
				`/collections/${collectionId}/items/${itemType}/${itemId}`,
			);
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: ["collections"] });
			queryClient.invalidateQueries({
				queryKey: [
					"collections",
					"for-item",
					variables.itemType,
					variables.itemId,
				],
			});
			queryClient.invalidateQueries({
				queryKey: ["collections", variables.collectionId],
			});
			toast.success({
				title: "Removed from collection",
				description: "The item has been removed from the collection.",
			});
		},
		onError: () => {
			toast.error({
				title: "Error",
				description:
					"Failed to remove item from collection. Please try again.",
			});
		},
	});
}
