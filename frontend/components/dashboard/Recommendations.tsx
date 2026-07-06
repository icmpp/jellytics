"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRecommendations } from "@/hooks/useRecommendations";
import { PosterImage } from "@/components/ui/poster-image";
import { resolvePosterUrl } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/loading-skeleton";

export function RecommendationsContent() {
  const { data, isLoading } = useRecommendations(12);
  const items = data?.items ?? [];
  const isEmpty = !isLoading && items.length === 0;
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    const updateScrollState = () => {
      const maxScrollLeft = el.scrollWidth - el.clientWidth;
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft < maxScrollLeft - 4);
    };

    updateScrollState();
    el.addEventListener("scroll", updateScrollState);
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);

    return () => {
      el.removeEventListener("scroll", updateScrollState);
      observer.disconnect();
    };
  }, [items.length, isLoading]);

  const scrollRow = (direction: "left" | "right") => {
    const el = rowRef.current;
    if (!el) return;
    const distance = Math.max(el.clientWidth * 0.8, 240);
    el.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
  };

  return (
    <>
      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="shrink-0 w-36 sm:w-40 md:w-44 aspect-2/3 rounded-sm" />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="min-h-[220px] flex flex-col items-center justify-center text-center gap-1">
          <p className="text-xs font-mono text-white/35 select-none">no_recommendations_yet</p>
          <p className="text-[10px] font-mono text-white/20 select-none">
            watch more titles to get personalized suggestions
          </p>
        </div>
      ) : (
        <div className="relative">
          <div
            ref={rowRef}
            className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 scrollbar-none snap-x snap-proximity"
          >
            {items.map((item) => (
              <Link
                key={`${item.type}-${item.id}`}
                href={item.type === "movie" ? `/movies/${item.id}` : `/shows/${item.id}`}
                className="group shrink-0 w-36 sm:w-40 md:w-44 snap-start"
              >
                <div className="relative aspect-2/3 rounded-sm overflow-hidden bg-[#0a0a12] border border-[#16162a] mb-2">
                  <PosterImage
                    src={resolvePosterUrl(item.posterUrl) ?? ""}
                    alt={item.title}
                    type={item.type}
                    sizes="176px"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {item.completionPercentage !== undefined &&
                    item.completionPercentage > 0 &&
                    item.completionPercentage < 100 && (
                      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-black/60">
                        <div
                          className="h-full bg-violet-500/80 transition-all"
                          style={{ width: `${item.completionPercentage}%` }}
                        />
                      </div>
                    )}
                </div>
                <p className="text-xs font-mono text-white/50 truncate group-hover:text-white/80 transition-colors leading-tight">
                  {item.title}
                </p>
                {item.reason === "similar" && (
                  <span className="inline-block mt-1 px-1.5 py-0.5 text-[9px] font-mono rounded-sm border border-amber-500/15 bg-amber-500/8 text-amber-400/70 select-none">
                    similar
                  </span>
                )}
                {item.reason === "watchlist" && (
                  <span className="inline-block mt-1 px-1.5 py-0.5 text-[9px] font-mono rounded-sm border border-violet-500/15 bg-violet-500/8 text-violet-400/70 select-none">
                    watchlist
                  </span>
                )}
                {item.reason === "discover" && (
                  <span className="inline-block mt-1 px-1.5 py-0.5 text-[9px] font-mono rounded-sm border border-emerald-500/15 bg-emerald-500/8 text-emerald-400/70 select-none">
                    discover
                  </span>
                )}
              </Link>
            ))}
          </div>
          <button
            type="button"
            onClick={() => scrollRow("left")}
            aria-label="Scroll recommendations left"
            className={`hidden lg:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 h-7 w-7 items-center justify-center rounded-sm border border-[#16162a] bg-[#07070d] transition-colors ${
              canScrollLeft
                ? "text-white/45 hover:text-white/80 hover:border-violet-500/25"
                : "pointer-events-none opacity-0"
            }`}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => scrollRow("right")}
            aria-label="Scroll recommendations right"
            className={`hidden lg:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 h-7 w-7 items-center justify-center rounded-sm border border-[#16162a] bg-[#07070d] transition-colors ${
              canScrollRight
                ? "text-white/45 hover:text-white/80 hover:border-violet-500/25"
                : "pointer-events-none opacity-0"
            }`}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>
  );
}
