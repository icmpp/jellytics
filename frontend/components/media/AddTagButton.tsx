"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tag, Plus } from "lucide-react";
import { useTags, useTagsForItem, useCreateTag, useAddTagToItem } from "@/hooks/useTags";
import { TagBadge } from "./TagBadge";

interface AddTagButtonProps {
  itemType: "movie" | "show";
  itemId: number;
  variant?: "default" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm";
  className?: string;
  iconOnly?: boolean;
}

export function AddTagButton({
  itemType,
  itemId,
  variant = "outline",
  size = "sm",
  className,
  iconOnly = false,
}: AddTagButtonProps) {
  const [open, setOpen] = useState(false);
  const { data: allTags = [] } = useTags();
  const { data: itemTags = [] } = useTagsForItem(itemType, itemId);
  const createTag = useCreateTag();
  const addTag = useAddTagToItem();

  const itemTagIds = new Set(itemTags.map((t) => t.id));
  const availableTags = allTags.filter((t) => !itemTagIds.has(t.id));

  const handleAddTag = (tagId: number) => {
    addTag.mutate({ tagId, itemType, itemId });
  };

  const handleCreateTag = () => {
    const name = window.prompt("Tag name");
    if (!name?.trim()) return;
    createTag.mutate(
      { name: name.trim() },
      {
        onSuccess: (data) => {
          addTag.mutate({ tagId: data.id, itemType, itemId });
        },
      },
    );
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={variant} size={size} className={className} aria-label="Add tag">
          <Tag className={iconOnly ? "size-6" : "h-3 w-3 mr-2"} />
          {!iconOnly && "Add tag"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <div className="space-y-2">
          {availableTags.length === 0 && allTags.length > 0 ? (
            <p className="text-sm text-white/50 py-2">All tags are already added.</p>
          ) : availableTags.length === 0 ? (
            <p className="text-sm text-white/50 py-2">No tags yet. Create one.</p>
          ) : (
            availableTags.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleAddTag(t.id)}
                disabled={addTag.isPending}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white/10 cursor-pointer"
              >
                <TagBadge name={t.name} color={t.color} />
              </button>
            ))
          )}
          <div className="border-t border-white/10 pt-2">
            <button
              type="button"
              onClick={handleCreateTag}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-purple-400 hover:bg-white/10 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Create new tag
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
