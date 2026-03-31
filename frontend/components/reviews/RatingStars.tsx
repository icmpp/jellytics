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
                "rounded-lg p-1.5 bg-white/[0.03] border border-white/[0.08] transition-all duration-200",
                interactive &&
                  "cursor-pointer hover:scale-110 hover:bg-white/[0.08] hover:border-purple-500/30",
                !interactive && "cursor-default",
                isFilled && "bg-purple-500/20 border-purple-500/30",
              )}
            >
              <Star
                className={cn(
                  sizeClasses[size],
                  "transition-colors duration-200",
                  isFilled ? "fill-purple-400 text-purple-400" : "fill-white/10 text-white/30",
                  interactive && !isFilled && "hover:fill-purple-400/50 hover:text-purple-400/50",
                )}
              />
            </button>
          );
        })}
      </div>
      {showValue && (
        <span className="text-sm text-white/40 ml-1 shrink-0">
          {rating !== null ? `${rating}/${maxRating}` : "Not rated"}
        </span>
      )}
    </div>
  );
}
