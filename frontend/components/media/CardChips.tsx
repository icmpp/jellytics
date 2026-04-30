"use client";

import { useTagsForItem } from "@/hooks/useTags";
import { parseGenres, cn } from "@/lib/utils";

interface CardChipsProps {
  itemType: "movie" | "show";
  itemId: number;
  genre?: string;
  /** Maximum number of chips to render. Default: 2. */
  max?: number;
  className?: string;
}

/**
 * Renders up to `max` chips beneath a card title: first genre plus first
 * user tag. Defers the tag query until genre doesn't already fill the slot.
 */
export function CardChips({ itemType, itemId, genre, max = 2, className }: CardChipsProps) {
  const primaryGenre = parseGenres(genre)[0];
  const { data: tags = [] } = useTagsForItem(itemType, itemId);
  const topTag = tags[0];

  const chips: { label: string; color?: string }[] = [];
  if (primaryGenre) chips.push({ label: primaryGenre });
  if (topTag) chips.push({ label: topTag.name, color: topTag.color });

  const visible = chips.slice(0, max);
  if (visible.length === 0) return null;

  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-1", className)}>
      {visible.map((chip, i) => (
        <span
          key={`${chip.label}-${i}`}
          className={cn(
            "inline-flex max-w-full items-center truncate rounded-md",
            "border border-white/[0.08] bg-white/[0.05] px-2 py-0.5",
            "text-[10px] font-medium leading-none tracking-wide text-white/55",
          )}
          style={chip.color ? { backgroundColor: `${chip.color}1f`, color: chip.color } : undefined}
        >
          <span className="truncate">{chip.label}</span>
        </span>
      ))}
    </div>
  );
}
