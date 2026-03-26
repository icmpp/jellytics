"use client";

import { useState, useMemo } from "react";
import { useRemoveFromWatchlist, useWatchlist } from "@/hooks/useWatchlist";
import { Button } from "@/components/ui/button";
import { ConfirmPopover } from "@/components/ui/confirm-popover";
import { Loader2, Trash2 } from "lucide-react";

interface RemoveFromWatchlistButtonProps {
  watchlistItemId?: number;
  itemType?: "show" | "movie";
  itemId?: number;
  variant?:
    | "default"
    | "outline"
    | "ghost"
    | "destructive"
    | "secondary"
    | "link";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg";
  className?: string;
  showConfirmation?: boolean;
  children?: React.ReactNode;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function RemoveFromWatchlistButton({
  watchlistItemId,
  itemType,
  itemId,
  variant = "ghost",
  size = "icon-sm",
  className,
  showConfirmation = true,
  children,
  onSuccess,
  onError,
}: RemoveFromWatchlistButtonProps) {
  const [open, setOpen] = useState(false);
  const removeFromWatchlist = useRemoveFromWatchlist();
  const { data: watchlistData } = useWatchlist();

  const itemTitle = useMemo(() => {
    if (watchlistItemId && watchlistData) {
      const item = watchlistData.items.find((i) => i.id === watchlistItemId);
      return item?.title ?? null;
    }
    if (
      itemType !== undefined &&
      itemType !== null &&
      itemId !== undefined &&
      itemId !== null &&
      watchlistData
    ) {
      const item = watchlistData.items.find(
        (i) => i.item_type === itemType && i.item_id === itemId,
      );
      return item?.title ?? null;
    }
    return null;
  }, [watchlistItemId, itemType, itemId, watchlistData]);

  const handleRemove = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    try {
      const params = watchlistItemId
        ? watchlistItemId
        : { itemType: itemType!, itemId: itemId! };

      await removeFromWatchlist.mutateAsync(params);
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      onError?.(error as Error);
      if (!showConfirmation) {
        setOpen(false);
      }
    }
  };

  const isLoading = removeFromWatchlist.isPending;
  const buttonContent = children || <Trash2 className="h-4 w-4" />;

  if (showConfirmation) {
    return (
      <ConfirmPopover
        open={open}
        onOpenChange={setOpen}
        title="Remove from watchlist?"
        description={
          itemTitle ? (
            <>
              <span className="text-white/60">&quot;{itemTitle}&quot;</span> will
              be removed.
            </>
          ) : (
            "This item will be removed from your watchlist."
          )
        }
        confirmLabel="Remove"
        cancelLabel="Cancel"
        confirmIcon={Trash2}
        variant="destructive"
        isLoading={isLoading}
        onConfirm={handleRemove}
      >
        <Button
          type="button"
          variant={variant}
          size={size}
          className={className}
          aria-label="Remove from watchlist"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            buttonContent
          )}
        </Button>
      </ConfirmPopover>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleRemove(e);
      }}
      disabled={isLoading}
      aria-label="Remove from watchlist"
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : buttonContent}
    </Button>
  );
}
