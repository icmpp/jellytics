"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface RatingStarsProps {
  rating: number | null;
  onRatingChange?: (rating: number) => void;
  maxRating?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  showValue?: boolean;
}

export function RatingStars({
  rating,
  onRatingChange,
  maxRating = 5,
  size = "md",
  interactive = false,
  showValue = false,
}: RatingStarsProps) {
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [isHovering, setIsHovering] = useState(false);

  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const displayRating = isHovering && hoveredRating !== null ? hoveredRating : rating || 0;

  const handleClick = (value: number) => {
    if (interactive && onRatingChange) {
      onRatingChange(value);
    }
  };

  const handleMouseEnter = (value: number) => {
    if (interactive) {
      setIsHovering(true);
      setHoveredRating(value);
    }
  };

  const handleMouseLeave = () => {
    if (interactive) {
      setIsHovering(false);
      setHoveredRating(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-full">
      <div className="flex items-center gap-1" onMouseLeave={handleMouseLeave}>
        {Array.from({ length: maxRating }, (_, i) => {
          const value = i + 1;
          const isFilled = value <= displayRating;

          return (
            <button
              key={value}
              type="button"
              onClick={() => handleClick(value)}
              onMouseEnter={() => handleMouseEnter(value)}
              disabled={!interactive}
              className={cn(
                "rounded-sm p-1.5 bg-[#0a0a14] border border-[#16162a] transition-all duration-200",
                interactive &&
                  "cursor-pointer hover:scale-110 hover:bg-[#0d0d1a] hover:border-violet-500/40",
                !interactive && "cursor-default",
                isFilled && "bg-violet-500/15 border-violet-500/30",
              )}
            >
              <Star
                className={cn(
                  sizeClasses[size],
                  "transition-colors duration-200",
                  isFilled ? "fill-violet-400 text-violet-400" : "fill-white/10 text-white/25",
                  interactive && !isFilled && "hover:fill-violet-400/50 hover:text-violet-400/50",
                )}
              />
            </button>
          );
        })}
      </div>
      {showValue && (
        <span className="ml-1 shrink-0 font-mono text-xs tabular-nums text-violet-300/70">
          {rating !== null ? `${rating}/${maxRating}` : "not_rated"}
        </span>
      )}
    </div>
  );
}
