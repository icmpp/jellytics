"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { Star, ExternalLink } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AddTagButton } from "@/components/media/AddTagButton";
import { AddRemoveWatchlistButton } from "@/components/watchlist/AddRemoveWatchlistButton";
import { AddToCollectionButton } from "@/components/collections/AddToCollectionButton";
import { useRating, useSetRating, useDeleteRating } from "@/hooks/useRatings";
import { useSettings } from "@/hooks/useSettings";
import { buildJellyfinItemUrl, cn } from "@/lib/utils";

interface CardHoverActionsProps {
  itemType: "movie" | "show";
  itemId: number;
  jellyfinId?: string;
}

/**
 * Centered overlay that fades in on group-hover. The outer wrapper is
 * pointer-events-none so clicks on the dark tint fall through to the card link;
 * only the action pill itself captures pointer events.
 */
export function CardHoverActions({ itemType, itemId, jellyfinId }: CardHoverActionsProps) {
  const stop = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 z-20 flex items-center justify-center",
        "bg-black/0 opacity-0 transition-all duration-300 ease-out",
        "group-hover:bg-black/30 group-hover:opacity-100",
      )}
    >
      <div
        onClick={stop}
        className={cn(
          "pointer-events-auto",
          "flex items-center gap-0.5 rounded-full",
          "border border-white/12 bg-black/50 px-1 py-1",
          "shadow-xl shadow-black/50 backdrop-blur-xl",
          "scale-95 transition-transform duration-300 ease-out group-hover:scale-100",
        )}
      >
        <RateAction itemType={itemType} itemId={itemId} />
        <ActionSlot>
          <AddTagButton
            itemType={itemType}
            itemId={itemId}
            variant="ghost"
            size="icon-sm"
            iconOnly
            className="h-8! w-8! rounded-full bg-white/[0.07] text-white hover:bg-white/15"
          />
        </ActionSlot>
        <ActionSlot>
          <AddRemoveWatchlistButton
            itemType={itemType}
            itemId={itemId}
            variant="ghost"
            size="icon-sm"
            iconOnly
            className="h-8! w-8! rounded-full bg-white/[0.07] text-white hover:bg-white/15"
          />
        </ActionSlot>
        <ActionSlot>
          <AddToCollectionButton
            itemType={itemType}
            itemId={itemId}
            variant="ghost"
            size="icon-sm"
            iconOnly
            className="h-8! w-8! rounded-full bg-white/[0.07] text-white hover:bg-white/15"
          />
        </ActionSlot>
        {jellyfinId && <OpenInJellyfin itemType={itemType} jellyfinId={jellyfinId} />}
      </div>
    </div>
  );
}

function ActionSlot({ children }: { children: ReactNode }) {
  return <div className="shrink-0">{children}</div>;
}

function RateAction({ itemType, itemId }: { itemType: "movie" | "show"; itemId: number }) {
  const [open, setOpen] = useState(false);
  const { data: rating } = useRating(itemType, itemId);
  const setRating = useSetRating();
  const deleteRating = useDeleteRating();

  const current = rating?.rating ?? 0;

  const handleSet = (value: number) => {
    if (value === current) {
      deleteRating.mutate({ itemType, itemId });
    } else {
      setRating.mutate({ itemType, itemId, rating: value });
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={current ? `Rated ${current}/5` : "Rate"}
          title={current ? `Rated ${current}/5` : "Rate"}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            "transition-colors duration-150",
            current > 0
              ? "bg-amber-500/95 text-white shadow-sm shadow-amber-500/30"
              : "bg-white/[0.07] text-white hover:bg-white/15",
          )}
        >
          <Star className={cn("h-4 w-4", current > 0 && "fill-white")} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-auto p-2">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleSet(n)}
              aria-label={`${n} star${n !== 1 ? "s" : ""}`}
              className={cn(
                "rounded-md p-1 transition-colors hover:bg-white/10",
                n <= current ? "text-amber-300" : "text-white/30",
              )}
            >
              <Star className={cn("h-5 w-5", n <= current && "fill-amber-300")} />
            </button>
          ))}
          {current > 0 && (
            <button
              type="button"
              onClick={() => {
                deleteRating.mutate({ itemType, itemId });
                setOpen(false);
              }}
              className="ml-1 px-2 text-xs text-white/40 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function OpenInJellyfin({
  itemType,
  jellyfinId,
}: {
  itemType: "movie" | "show";
  jellyfinId: string;
}) {
  const { data: settings } = useSettings();
  if (!settings?.jellyfin_server_url) return null;

  const href = buildJellyfinItemUrl(
    settings.jellyfin_server_url,
    jellyfinId,
    settings.jellyfin_server_id,
    itemType,
  );

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(href, "_blank", "noopener,noreferrer");
      }}
      aria-label="Open in Jellyfin"
      title="Open in Jellyfin"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-white transition-colors hover:bg-white/15"
    >
      <ExternalLink className="h-4 w-4" />
    </button>
  );
}
