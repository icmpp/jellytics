"use client";

import { useState } from "react";
import Image from "next/image";
import { Film, Tv } from "lucide-react";

interface PosterImageProps {
  src: string | undefined;
  alt: string;
  type?: "movie" | "show";
  className?: string;
  sizes?: string;
  hoverScale?: boolean;
  iconSize?: string;
  showLabel?: boolean;
  /** Use for above-the-fold images (e.g. first watchlist items) to load immediately */
  priority?: boolean;
}

export function PosterImage({
  src,
  alt,
  type = "movie",
  className = "object-cover",
  sizes = "(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw",
  hoverScale = false,
  iconSize = "h-10 w-10",
  showLabel = true,
  priority = false,
}: PosterImageProps) {
  const [imgError, setImgError] = useState(false);
  const FallbackIcon = type === "show" ? Tv : Film;

  if (!src || imgError) {
    return (
      <div className="w-full h-full bg-white/[0.05] flex flex-col items-center justify-center gap-2">
        <FallbackIcon className={`${iconSize} text-white/20`} />
        {showLabel && <span className="text-white/20 text-xs">No Image</span>}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className={`${className}${hoverScale ? " group-hover:scale-105 transition-transform duration-500" : ""}`}
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      priority={priority}
      onError={() => setImgError(true)}
    />
  );
}
