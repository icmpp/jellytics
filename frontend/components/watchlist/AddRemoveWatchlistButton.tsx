"use client";

import { useIsInWatchlist, useAddToWatchlist } from "@/hooks/useWatchlist";
import { RemoveFromWatchlistButton } from "./RemoveFromWatchlistButton";
import { Button } from "@/components/ui/button";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";

interface AddRemoveWatchlistButtonProps {
  itemType: "show" | "movie";
  itemId: number;
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary" | "link";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg";
  className?: string;
  showConfirmation?: boolean;
  iconOnly?: boolean;
}

export function AddRemoveWatchlistButton({
  itemType,
  itemId,
  variant = "outline",
  size = "sm",
  className,
  showConfirmation = false,
  iconOnly = false,
}: AddRemoveWatchlistButtonProps) {
  const isInWatchlist = useIsInWatchlist(itemType, itemId);
  const addToWatchlist = useAddToWatchlist();

  if (isInWatchlist) {
    return (
      <RemoveFromWatchlistButton
        itemType={itemType}
        itemId={itemId}
        variant={variant}
        size={size}
        className={className}
        showConfirmation={showConfirmation}
      >
        <BookmarkCheck
          className={iconOnly ? "size-6 text-purple-400" : "h-4 w-4 text-purple-400"}
        />
        {!iconOnly && "In Watchlist"}
      </RemoveFromWatchlistButton>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => {
        addToWatchlist.mutate({ itemType, itemId });
      }}
      disabled={addToWatchlist.isPending}
      aria-label="Add to Watchlist"
    >
      {addToWatchlist.isPending ? (
        <Loader2 className={iconOnly ? "size-6 animate-spin" : "h-4 w-4 animate-spin"} />
      ) : (
        <Bookmark className={iconOnly ? "size-6" : "h-4 w-4"} />
      )}
      {!iconOnly && (addToWatchlist.isPending ? "Adding..." : "Add to Watchlist")}
    </Button>
  );
}
