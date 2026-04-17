"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMilestones, type Milestone } from "@/hooks/useStats";
import { Trophy, Lock, ChevronLeft, ChevronRight } from "lucide-react";
import { ChartCard } from "@/components/ui/chart-card";

export function Milestones() {
  const { data: milestones, isLoading } = useMilestones();
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const { ordered, achievedCount } = useMemo((): {
    ordered: Milestone[];
    achievedCount: number;
  } => {
    if (!milestones?.length) return { ordered: [], achievedCount: 0 };
    const achieved = milestones.filter((m) => m.achieved);
    const locked = milestones.filter((m) => !m.achieved);
    return {
      ordered: [...achieved, ...locked],
      achievedCount: achieved.length,
    };
  }, [milestones]);

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
  }, [ordered.length]);

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
    <ChartCard
      title="Milestones"
      icon={<Trophy className="h-5 w-5 text-amber-400" />}
      isLoading={isLoading}
      minHeight="min-h-[120px]"
      isEmpty={!milestones?.length}
      emptyMessage="No milestones yet"
      emptyDescription="Keep watching to unlock milestones"
      emptyIcon={<Trophy className="h-10 w-10" />}
      titleExtra={
        milestones && milestones.length > 0 ? (
          <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-xs tabular-nums text-amber-200">
            {achievedCount}/{milestones.length} unlocked
          </span>
        ) : null
      }
    >
      <div className="relative">
        <div
          ref={rowRef}
          className="flex gap-4 sm:gap-5 overflow-x-auto pb-2 scrollbar-none snap-x snap-proximity"
        >
          {ordered.map((m) => (
            <div
              key={m.id}
              className={`shrink-0 w-36 sm:w-40 md:w-44 rounded-xl border p-3.5 sm:p-4 transition-all snap-start ${
                m.achieved
                  ? "bg-linear-to-br from-amber-500/10 to-amber-600/5 border-amber-500/25 hover:border-amber-500/40"
                  : "bg-white/2 border-white/6 opacity-50"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-2xl">{m.icon}</span>
                {!m.achieved && <Lock className="h-3.5 w-3.5 text-white/25" />}
              </div>
              <p className="text-sm font-semibold text-white mb-1 leading-tight">{m.title}</p>
              <p className="text-xs text-white/45 leading-snug">{m.description}</p>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => scrollRow("left")}
          aria-label="Scroll milestones left"
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
          aria-label="Scroll milestones right"
          className={`hidden lg:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/60 backdrop-blur-sm transition ${
            canScrollRight
              ? "text-white/80 hover:text-white hover:bg-black/80"
              : "pointer-events-none opacity-0"
          }`}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </ChartCard>
  );
}
