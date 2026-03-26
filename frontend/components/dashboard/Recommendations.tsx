"use client";

import Link from "next/link";
import { useRecommendations } from "@/hooks/useRecommendations";
import { PosterImage } from "@/components/ui/poster-image";
import { SectionHeader } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { resolvePosterUrl } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/loading-skeleton";

export function Recommendations() {
  const { data, isLoading } = useRecommendations(12);
  const items = data?.items ?? [];
  const isEmpty = !isLoading && items.length === 0;

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
              <Skeleton
                key={i}
                className="shrink-0 w-36 sm:w-40 md:w-44 aspect-[2/3] rounded-xl"
              />
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
          <div className="flex gap-4 sm:gap-5 overflow-x-auto pb-2 scrollbar-none scroll-snap-x">
        {items.map((item) => (
          <Link
            key={`${item.type}-${item.id}`}
            href={
              item.type === "movie"
                ? `/movies/${item.id}`
                : `/shows/${item.id}`
            }
            className="group shrink-0 w-36 sm:w-40 md:w-44 scroll-snap-start"
          >
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-white/[0.04] border border-white/[0.08] mb-2">
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
              <p className="text-xs text-amber-400/80 mt-0.5">
                Similar to your favorites
              </p>
            )}
            {item.reason === "watchlist" && (
              <p className="text-xs text-purple-400/80 mt-0.5">
                In your watchlist
              </p>
            )}
            {item.reason === "discover" && (
              <p className="text-xs text-emerald-400/80 mt-0.5">
                Discover
              </p>
            )}
          </Link>
        ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
