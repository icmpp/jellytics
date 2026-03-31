"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, FolderPlus } from "lucide-react";
import { useMovies } from "@/hooks/useMovies";
import { useShows } from "@/hooks/useShows";
import { PosterImage } from "@/components/ui/poster-image";
import { SectionHeader } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { getMoviePosterUrl, getShowPosterUrl } from "@/lib/utils";

interface RecentItem {
  id: number;
  title: string;
  type: "movie" | "show";
  posterUrl: string;
  createdAt: string;
  year?: number;
}

export function RecentlyAdded() {
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
    return items.slice(0, 8);
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
    <Card>
      <CardContent>
        <SectionHeader
          icon={<FolderPlus className="h-5 w-5 text-emerald-400" />}
          title="Recently Added"
        />
        {top.length === 0 ? (
          <div className="min-h-[220px] flex flex-col items-center justify-center text-center">
            <FolderPlus className="h-10 w-10 text-white/15 mb-3" />
            <p className="text-sm font-medium text-white/60">No recently added titles</p>
            <p className="text-xs text-white/40 mt-1">
              New movies and shows from your library will appear here
            </p>
          </div>
        ) : (
          <div className="relative">
            <div
              ref={rowRef}
              className="flex gap-4 sm:gap-5 overflow-x-auto pb-2 scrollbar-none snap-x snap-proximity"
            >
              {top.map((item) => (
                <Link
                  key={`${item.type}-${item.id}`}
                  href={item.type === "movie" ? `/movies/${item.id}` : `/shows/${item.id}`}
                  className="group shrink-0 w-36 sm:w-40 md:w-44 snap-start"
                >
                  <div className="relative aspect-2/3 rounded-xl overflow-hidden bg-white/4 border border-white/8 mb-2">
                    <PosterImage
                      src={item.posterUrl}
                      alt={item.title}
                      type={item.type}
                      sizes="176px"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <p className="text-sm text-white/80 truncate group-hover:text-white transition-colors leading-tight">
                    {item.title}
                  </p>
                  {item.year && <p className="text-xs text-white/40 mt-1">{item.year}</p>}
                </Link>
              ))}
            </div>
            <button
              type="button"
              onClick={() => scrollRow("left")}
              aria-label="Scroll recently added left"
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
              aria-label="Scroll recently added right"
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
