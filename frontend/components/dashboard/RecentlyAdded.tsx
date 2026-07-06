"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMovies } from "@/hooks/useMovies";
import { useShows } from "@/hooks/useShows";
import { PosterImage } from "@/components/ui/poster-image";
import { getMoviePosterUrl, getShowPosterUrl } from "@/lib/utils";

interface RecentItem {
  id: number;
  title: string;
  type: "movie" | "show";
  posterUrl: string;
  createdAt: string;
  year?: number;
}

const CUTOFF_MS = Date.now() - 7 * 24 * 60 * 60 * 1000;

export function RecentlyAddedContent() {
  const { data: moviesData } = useMovies({ limit: 10 });
  const { data: showsData } = useShows({ limit: 10 });
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const top = useMemo(() => {
    const items: RecentItem[] = [];
    moviesData?.movies?.forEach((m) => {
      if (m.created_at) {
        items.push({
          id: m.id,
          title: m.title,
          type: "movie",
          posterUrl: getMoviePosterUrl(m.jellyfin_id),
          createdAt: m.created_at,
          year: m.year,
        });
      }
    });
    showsData?.shows?.forEach((s) => {
      if (s.created_at) {
        items.push({
          id: s.id,
          title: s.title,
          type: "show",
          posterUrl: getShowPosterUrl(s.jellyfin_id),
          createdAt: s.created_at,
          year: s.year,
        });
      }
    });
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items.filter((item) => new Date(item.createdAt).getTime() >= CUTOFF_MS).slice(0, 8);
  }, [moviesData?.movies, showsData?.shows]);

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
  }, [top.length]);

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
      {top.length === 0 ? (
        <div className="min-h-[220px] flex flex-col items-center justify-center text-center gap-1">
          <p className="text-xs font-mono text-white/35 select-none">no_recently_added</p>
          <p className="text-[10px] font-mono text-white/20 select-none">
            new movies and shows from your library will appear here
          </p>
        </div>
      ) : (
        <div className="relative">
          <div
            ref={rowRef}
            className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 scrollbar-none snap-x snap-proximity"
          >
            {top.map((item) => (
              <Link
                key={`${item.type}-${item.id}`}
                href={item.type === "movie" ? `/movies/${item.id}` : `/shows/${item.id}`}
                className="group shrink-0 w-36 sm:w-40 md:w-44 snap-start"
              >
                <div className="relative aspect-2/3 rounded-sm overflow-hidden bg-[#0a0a12] border border-[#16162a] mb-2">
                  <PosterImage
                    src={item.posterUrl}
                    alt={item.title}
                    type={item.type}
                    sizes="176px"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <p className="text-xs font-mono text-white/50 truncate group-hover:text-white/80 transition-colors leading-tight">
                  {item.title}
                </p>
                {item.year && (
                  <p className="text-[10px] font-mono text-white/25 mt-0.5">{item.year}</p>
                )}
              </Link>
            ))}
          </div>
          <button
            type="button"
            onClick={() => scrollRow("left")}
            aria-label="Scroll recently added left"
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
            aria-label="Scroll recently added right"
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
