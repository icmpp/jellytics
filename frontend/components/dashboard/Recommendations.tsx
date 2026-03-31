"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRecommendations } from "@/hooks/useRecommendations";
import { PosterImage } from "@/components/ui/poster-image";
import { SectionHeader } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { resolvePosterUrl } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/loading-skeleton";

export function Recommendations() {
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
    <Card>
      <CardContent>
        <SectionHeader
          icon={<Sparkles className="h-5 w-5 text-amber-400" />}
          title="Recommended for you"
        />
        {isLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="shrink-0 w-36 sm:w-40 md:w-44 aspect-2/3 rounded-xl" />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="min-h-[220px] flex flex-col items-center justify-center text-center">
            <Sparkles className="h-10 w-10 text-white/15 mb-3" />
            <p className="text-sm font-medium text-white/60">No recommendations yet</p>
            <p className="text-xs text-white/40 mt-1">
              Watch more titles to get personalized suggestions
            </p>
          </div>
        ) : (
          <div className="relative">
            <div
              ref={rowRef}
              className="flex gap-4 sm:gap-5 overflow-x-auto pb-2 scrollbar-none snap-x snap-proximity"
            >
              {items.map((item) => (
                <Link
                  key={`${item.type}-${item.id}`}
                  href={item.type === "movie" ? `/movies/${item.id}` : `/shows/${item.id}`}
                  className="group shrink-0 w-36 sm:w-40 md:w-44 snap-start"
                >
                  <div className="relative aspect-2/3 rounded-xl overflow-hidden bg-white/4 border border-white/8 mb-2">
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
                        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/40">
                          <div
                            className="h-full bg-amber-500 transition-all"
                            style={{ width: `${item.completionPercentage}%` }}
                          />
                        </div>
                      )}
                  </div>
                  <p className="text-sm text-white/80 truncate group-hover:text-white transition-colors leading-tight">
                    {item.title}
                  </p>
                  {item.reason === "similar" && (
                    <p className="text-xs text-amber-400/80 mt-0.5">Similar to your favorites</p>
                  )}
                  {item.reason === "watchlist" && (
                    <p className="text-xs text-purple-400/80 mt-0.5">In your watchlist</p>
                  )}
                  {item.reason === "discover" && (
                    <p className="text-xs text-emerald-400/80 mt-0.5">Discover</p>
                  )}
                </Link>
              ))}
            </div>
            <button
              type="button"
              onClick={() => scrollRow("left")}
              aria-label="Scroll recommendations left"
              className={`hidden lg:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/60 backdrop-blur-sm transition ${
                canScrollLeft
                  ? "text-white/80 hover:text-white hover:bg-black/80"
                  : "pointer-events-none opacity-0"
              }`}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => scrollRow("right")}
              aria-label="Scroll recommendations right"
              className={`hidden lg:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/60 backdrop-blur-sm transition ${
                canScrollRight
                  ? "text-white/80 hover:text-white hover:bg-black/80"
                  : "pointer-events-none opacity-0"
              }`}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
