"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { SectionHeader } from "@/components/layout";
import { useCurrentlyWatching } from "@/hooks/useStats";
import type { ActiveSession } from "@/hooks/useStats";
import { Play, Pause, Film, Tv, Monitor, Smartphone, Tablet } from "lucide-react";
import { PROGRESS_BAR_CLASS, getImageUrl } from "@/lib/utils";

function formatTime(ticks: number): string {
  const seconds = Math.floor(ticks / 10000000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function getDeviceIcon(deviceType: string, clientName: string) {
  const d = deviceType.toLowerCase();
  const c = clientName.toLowerCase();
  if (d.includes("mobile") || c.includes("mobile")) return <Smartphone className="h-3.5 w-3.5" />;
  if (d.includes("tablet") || c.includes("tablet")) return <Tablet className="h-3.5 w-3.5" />;
  if (d.includes("tv") || c.includes("android tv") || c.includes("roku"))
    return <Tv className="h-3.5 w-3.5" />;
  return <Monitor className="h-3.5 w-3.5" />;
}

interface SessionCardProps {
  session: ActiveSession;
}

function SessionCard({ session }: SessionCardProps) {
  const timePosition = formatTime(session.position_ticks);
  const timeRemaining = formatTime(Math.max(0, session.runtime_ticks - session.position_ticks));
  const progressPercent =
    session.runtime_ticks > 0 ? (session.position_ticks / session.runtime_ticks) * 100 : 0;
  const isEpisode = session.item_type === "Episode";

  const posterUrl = isEpisode
    ? getImageUrl("shows", session.series_id || session.item_id)
    : getImageUrl("movies", session.item_id);

  return (
    <div className="shrink-0 w-[85%] sm:w-[75%] lg:w-full lg:shrink snap-start rounded-2xl border border-white/8 bg-white/3 backdrop-blur-xl p-3 sm:p-4 hover:border-white/12 hover:bg-white/5 transition-all duration-300">
      <div className="flex items-stretch gap-3">
        {/* Poster */}
        <div className="relative w-16 shrink-0 rounded-xl overflow-hidden bg-white/5 border border-white/8 self-stretch min-h-[68px]">
          <div className="absolute inset-0 flex items-center justify-center text-white/20">
            {isEpisode ? <Tv className="h-4 w-4" /> : <Film className="h-4 w-4" />}
          </div>
          {posterUrl && <Image src={posterUrl} alt="" fill className="object-cover" sizes="64px" />}
          {/* Bottom gradient overlay */}
          <div className="absolute inset-x-0 bottom-0 h-6 bg-linear-to-t from-black/40 to-transparent" />
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {/* Title + status badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate leading-snug">
                {session.item_name}
              </p>
              {isEpisode && session.series_name && (
                <p className="text-[11px] text-white/40 truncate mt-0.5">
                  {session.series_name}
                  {session.season_number &&
                    session.episode_number &&
                    ` · S${session.season_number}E${session.episode_number}`}
                </p>
              )}
            </div>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                session.is_paused
                  ? "bg-white/8 text-white/40 border border-white/10"
                  : "bg-purple-500/15 text-purple-300 border border-purple-500/25"
              }`}
            >
              {session.is_paused ? (
                <Pause className="h-2.5 w-2.5" />
              ) : (
                <Play className="h-2.5 w-2.5" />
              )}
              {session.is_paused ? "Paused" : "Playing"}
            </span>
          </div>

          {/* Progress */}
          <div className="space-y-1 mt-auto">
            <div className={PROGRESS_BAR_CLASS}>
              <div
                className="h-full bg-linear-to-r from-purple-500 to-purple-400 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-white/35 tabular-nums">
              <span>{timePosition}</span>
              <span>
                {Math.round(session.playback_percentage)}% · {timeRemaining} left
              </span>
            </div>
          </div>

          {/* Device */}
          <div className="flex items-center gap-1.5 text-[11px] text-white/30">
            {getDeviceIcon(session.device_type, session.client_name)}
            <span className="truncate">{session.device_name || session.client_name}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionSkeleton() {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-3 sm:p-4">
      <div className="flex items-stretch gap-3">
        <div className="w-11 min-h-[68px] rounded-xl bg-white/8 animate-pulse shrink-0" />
        <div className="flex-1 space-y-2.5 pt-0.5">
          <div className="h-4 w-3/4 bg-white/8 rounded-lg animate-pulse" />
          <div className="h-3 w-1/2 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-1.5 w-full bg-white/8 rounded-full animate-pulse mt-2" />
        </div>
      </div>
    </div>
  );
}

export function CurrentlyWatching() {
  const { data, isLoading, isFetching } = useCurrentlyWatching();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const isEmpty = !data || data.count === 0;
  const sessionCount = data?.sessions?.length ?? 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || sessionCount <= 1) return;

    const onScroll = () => {
      const cardWidth = el.firstElementChild
        ? (el.firstElementChild as HTMLElement).offsetWidth
        : 1;
      setActiveIndex(Math.round(el.scrollLeft / (cardWidth + 8)));
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [sessionCount]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/3 backdrop-blur-xl p-4 sm:p-5 flex flex-col gap-4 hover:border-white/12 hover:bg-white/5 transition-all duration-300">
      {/* Corner glow */}
      <div className="pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full blur-3xl opacity-10 bg-purple-500" />

      <div className="relative">
        <SectionHeader
          icon={<Play className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400" />}
          iconBg="bg-purple-500/15 border border-purple-500/25"
          title="Currently Watching"
          extra={
            !isEmpty ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-white/35">
                  {data.count} {data.count === 1 ? "session" : "sessions"}
                </span>
                {isFetching && !isLoading && (
                  <div className="h-1 w-14 bg-purple-500/20 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 animate-pulse" style={{ width: "60%" }} />
                  </div>
                )}
              </div>
            ) : undefined
          }
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <SessionSkeleton />
          <SessionSkeleton />
        </div>
      ) : isEmpty ? (
        <div className="min-h-[140px] sm:min-h-[180px] flex flex-col items-center justify-center text-center gap-2">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/8 mb-1">
            <Play className="h-6 w-6 text-white/20" />
          </div>
          <p className="text-sm font-medium text-white/50">Nothing playing right now</p>
          <p className="text-xs text-white/25">Active Jellyfin sessions will appear here</p>
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            className="flex lg:flex-col gap-2 sm:gap-3 overflow-x-auto lg:overflow-x-visible scrollbar-none snap-x snap-proximity lg:snap-none"
          >
            {data.sessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>

          {sessionCount > 1 && (
            <div className="flex lg:hidden justify-center gap-1.5">
              {data.sessions.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    i === activeIndex ? "w-4 bg-purple-400" : "w-1.5 bg-white/20"
                  }`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
