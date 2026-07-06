"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useCurrentlyWatching } from "@/hooks/useStats";
import type { ActiveSession } from "@/hooks/useStats";
import { Play, Pause, Film, Tv, Monitor, Smartphone, Tablet } from "lucide-react";
import { getImageUrl } from "@/lib/utils";

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
    <div className="shrink-0 w-[85%] sm:w-[75%] lg:w-full lg:shrink snap-start rounded-sm border border-[#16162a] bg-[#0a0a12] p-3 sm:p-4 hover:border-violet-500/20 transition-colors duration-200">
      <div className="flex items-stretch gap-3">
        {/* Poster */}
        <div className="relative w-14 shrink-0 rounded-sm overflow-hidden bg-[#0d0d1a] border border-[#16162a] self-stretch min-h-[64px]">
          <div className="absolute inset-0 flex items-center justify-center text-white/15">
            {isEpisode ? <Tv className="h-3.5 w-3.5" /> : <Film className="h-3.5 w-3.5" />}
          </div>
          {posterUrl && <Image src={posterUrl} alt="" fill className="object-cover" sizes="56px" />}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {/* Title + status badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-mono text-white/80 truncate leading-snug">
                {session.item_name}
              </p>
              {isEpisode && session.series_name && (
                <p className="text-[10px] font-mono text-white/35 truncate mt-0.5">
                  {session.series_name}
                  {session.season_number &&
                    session.episode_number &&
                    ` · S${session.season_number}E${session.episode_number}`}
                </p>
              )}
            </div>
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[9px] font-mono shrink-0 ${
                session.is_paused
                  ? "bg-white/5 text-white/30 border border-[#16162a]"
                  : "bg-violet-500/8 text-violet-400/80 border border-violet-500/20"
              }`}
            >
              {session.is_paused ? <Pause className="h-2 w-2" /> : <Play className="h-2 w-2" />}
              {session.is_paused ? "paused" : "playing"}
            </span>
          </div>

          {/* Progress */}
          <div className="space-y-1 mt-auto">
            <div className="w-full h-[3px] overflow-hidden rounded-sm bg-black/50">
              <div
                className="h-full bg-violet-500/70 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[9px] font-mono text-white/25 tabular-nums">
              <span>{timePosition}</span>
              <span>
                {Math.round(session.playback_percentage)}% · {timeRemaining} left
              </span>
            </div>
          </div>

          {/* Device */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/20">
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
    <div className="rounded-sm border border-[#16162a] bg-[#0a0a12] p-3 sm:p-4">
      <div className="flex items-stretch gap-3">
        <div className="w-14 min-h-[64px] rounded-sm bg-white/5 animate-pulse shrink-0" />
        <div className="flex-1 space-y-2 pt-0.5">
          <div className="h-3 w-3/4 bg-white/5 rounded-sm animate-pulse" />
          <div className="h-2.5 w-1/2 bg-white/3 rounded-sm animate-pulse" />
          <div className="h-[3px] w-full bg-white/5 rounded-sm animate-pulse mt-3" />
        </div>
      </div>
    </div>
  );
}

export function CurrentlyWatchingContent() {
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
    <div className="flex flex-col gap-3">
      {isFetching && !isLoading && (
        <div className="h-px w-full bg-[#16162a] overflow-hidden">
          <div className="h-full w-1/3 bg-violet-500/40 animate-pulse" />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <SessionSkeleton />
          <SessionSkeleton />
        </div>
      ) : isEmpty ? (
        <div className="min-h-[200px] flex flex-col items-center justify-center text-center gap-1">
          <p className="text-xs font-mono text-white/35 select-none">nothing_playing</p>
          <p className="text-[10px] font-mono text-white/20 select-none">
            active jellyfin sessions will appear here
          </p>
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible scrollbar-none snap-x snap-proximity lg:snap-none"
          >
            {data.sessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>

          {sessionCount > 1 && (
            <div className="flex lg:hidden justify-center gap-1 pt-1">
              {data.sessions.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-sm transition-all duration-200 ${
                    i === activeIndex ? "w-4 bg-violet-400/60" : "w-1 bg-white/15"
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
