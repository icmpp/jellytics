"use client";

import { Tag } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagBadgeProps {
  name: string;
  color?: string;
  className?: string;
  onRemove?: () => void;
}

export function TagBadge({ name, color = "#6366f1", className, onRemove }: TagBadgeProps) {
  const bg = `${color}20`;
  const border = `${color}50`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
        className,
      )}
      style={{
        backgroundColor: bg,
        borderColor: border,
        color: color,
      }}
    >
      <Tag className="h-3 w-3" />
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 hover:opacity-70 rounded"
          aria-label={`Remove ${name} tag`}
        >
          ×
        </button>
      )}
    </span>
  );
}
