"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Film, Tv, PlayCircle, X } from "lucide-react";
import { useSearch } from "@/hooks/useSearch";
import { PosterImage } from "@/components/ui/poster-image";
import { getMoviePosterUrl, getShowPosterUrl } from "@/lib/utils";

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { data, isFetching } = useSearch(query);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const hasResults =
    (data?.shows?.length ?? 0) > 0 ||
    (data?.movies?.length ?? 0) > 0 ||
    (data?.episodes?.length ?? 0) > 0;

  const handleNavigate = (path: string) => {
    router.push(path);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] sm:pt-[15vh] px-3 sm:px-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-2xl border border-white/10 bg-[#0d0d14]/95 shadow-2xl shadow-black/60 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
            <Search className="h-4 w-4 text-white/40 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search movies, shows, episodes…"
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-white/40 hover:text-white/70 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/30">
              ESC
            </kbd>
          </div>

          {query.length >= 2 && (
            <div className="max-h-[420px] overflow-y-auto py-2">
              {isFetching && !data && (
                <p className="px-4 py-3 text-sm text-white/30">Searching…</p>
              )}

              {data && !hasResults && (
                <p className="px-4 py-3 text-sm text-white/30">
                  No results for &quot;{query}&quot;
                </p>
              )}

              {(data?.movies?.length ?? 0) > 0 && (
                <ResultSection title="Movies" icon={<Film className="h-3.5 w-3.5" />}>
                  {data!.movies.map((m) => (
                    <ResultRow
                      key={m.id}
                      title={m.title}
                      subtitle={m.year?.toString()}
                      posterUrl={m.jellyfin_id ? getMoviePosterUrl(m.jellyfin_id) : undefined}
                      type="movie"
                      onClick={() => handleNavigate(`/movies/${m.id}`)}
                    />
                  ))}
                </ResultSection>
              )}

              {(data?.shows?.length ?? 0) > 0 && (
                <ResultSection title="Shows" icon={<Tv className="h-3.5 w-3.5" />}>
                  {data!.shows.map((s) => (
                    <ResultRow
                      key={s.id}
                      title={s.title}
                      subtitle={s.year?.toString()}
                      posterUrl={s.jellyfin_id ? getShowPosterUrl(s.jellyfin_id) : undefined}
                      type="show"
                      onClick={() => handleNavigate(`/shows/${s.id}`)}
                    />
                  ))}
                </ResultSection>
              )}

              {(data?.episodes?.length ?? 0) > 0 && (
                <ResultSection title="Episodes" icon={<PlayCircle className="h-3.5 w-3.5" />}>
                  {data!.episodes.map((ep) => (
                    <ResultRow
                      key={ep.id}
                      title={ep.title || `Episode ${ep.episode_number}`}
                      subtitle={`${ep.show_title} · S${ep.season_number}E${ep.episode_number}`}
                      posterUrl={ep.show_jellyfin_id ? getShowPosterUrl(ep.show_jellyfin_id) : undefined}
                      type="show"
                      onClick={() => handleNavigate(`/shows/${ep.show_id}`)}
                    />
                  ))}
                </ResultSection>
              )}
            </div>
          )}

          {query.length < 2 && (
            <div className="px-4 py-4 text-center text-sm text-white/25">
              Type at least 2 characters to search
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-medium text-white/30 uppercase tracking-wider">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function ResultRow({
  title,
  subtitle,
  posterUrl,
  type = "movie",
  onClick,
}: {
  title: string;
  subtitle?: string;
  posterUrl?: string;
  type?: "movie" | "show";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors group"
    >
      <div className="relative w-12 h-[72px] shrink-0 rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.08]">
        <PosterImage
          src={posterUrl}
          alt={title}
          type={type}
          className="object-cover"
          sizes="48px"
          iconSize="h-5 w-5"
          showLabel={false}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/90 truncate group-hover:text-white transition-colors">
          {title}
        </p>
        {subtitle && (
          <p className="text-xs text-white/35 truncate">{subtitle}</p>
        )}
      </div>
    </button>
  );
}
