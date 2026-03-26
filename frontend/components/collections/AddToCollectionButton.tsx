"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { FolderPlus, Check, Loader2 } from "lucide-react";
import {
	useCollectionsForItem,
	useCreateCollection,
	useAddToCollection,
	useRemoveFromCollection,
} from "@/hooks/useCollections";

interface AddToCollectionButtonProps {
	itemType: "movie" | "show";
	itemId: number;
	variant?: "default" | "outline" | "ghost" | "link";
	size?: "default" | "sm" | "lg" | "icon" | "icon-sm";
	className?: string;
}

export function AddToCollectionButton({
	itemType,
	itemId,
	variant = "outline",
	size = "sm",
	className,
}: AddToCollectionButtonProps) {
	const [open, setOpen] = useState(false);
	const { data: collections = [], isLoading } = useCollectionsForItem(
		itemType,
		itemId,
	);
	const createCollection = useCreateCollection();
	const addToCollection = useAddToCollection();
	const removeFromCollection = useRemoveFromCollection();

	const handleToggle = (collectionId: number, hasItem: boolean) => {
		if (hasItem) {
			removeFromCollection.mutate({ collectionId, itemType, itemId });
		} else {
			addToCollection.mutate({ collectionId, itemType, itemId });
		}
	};

	const handleCreateCollection = () => {
		const name = window.prompt("Collection name");
		if (!name?.trim()) return;
		createCollection.mutate(
			{ name: name.trim() },
			{
				onSuccess: (data) => {
					addToCollection.mutate({
						collectionId: data.id,
						itemType,
						itemId,
					});
				},
			},
		);
		setOpen(false);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant={variant} size={size} className={className}>
					<FolderPlus className="h-3 w-3 mr-2" />
					Add to collection
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-56 p-1">
				{isLoading ? (
					<div className="flex items-center justify-center py-4">
						<Loader2 className="h-4 w-4 animate-spin text-white/50" />
					</div>
				) : collections.length === 0 ? (
					<div className="py-3 px-2 text-sm text-white/50">
						No collections yet. Create one to get started.
					</div>
				) : (
					collections.map((c) => (
						<button
							key={c.id}
							type="button"
							onClick={() => handleToggle(c.id, c.hasItem ?? false)}
							className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white/10 cursor-pointer"
						>
							{c.hasItem ? (
								<Check className="h-4 w-4 text-purple-400 shrink-0" />
							) : (
								<span className="w-4 shrink-0" />
							)}
							<span className="truncate">{c.name}</span>
							{c.itemCount > 0 && (
								<span className="text-xs text-white/40 ml-auto">
									{c.itemCount}
								</span>
							)}
						</button>
					))
				)}
				<div className="border-t border-white/10 mt-1 pt-1">
					<button
						type="button"
						onClick={(e) => {
							e.preventDefault();
							handleCreateCollection();
						}}
						className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-purple-400 hover:bg-white/10 cursor-pointer"
					>
						<FolderPlus className="h-4 w-4" />
						Create new collection
					</button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
