"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Film, Tv, PlayCircle, X, CornerDownLeft } from "lucide-react";
import { useSearch } from "@/hooks/useSearch";
import { PosterImage } from "@/components/ui/poster-image";
import { getMoviePosterUrl, getShowPosterUrl, cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/components/layout/nav-items";

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

type FlatResult = { path: string };

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const router = useRouter();

  // Command-palette mode: a leading ">" switches from media search to actions.
  const commandMode = query.startsWith(">");
  const commandQuery = commandMode ? query.slice(1).trim().toLowerCase() : "";

  const { data, isFetching } = useSearch(commandMode ? "" : query);

  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setQuery("");
  }

  const commands = useMemo(() => {
    if (!commandMode) return [];
    return NAV_ITEMS.filter((n) => n.label.includes(commandQuery)).map((n) => ({
      label: `go to ${n.label}`,
      path: n.href,
      icon: n.icon,
    }));
  }, [commandMode, commandQuery]);

  const movieCount = data?.movies?.length ?? 0;
  const showCount = data?.shows?.length ?? 0;
  const episodeCount = data?.episodes?.length ?? 0;
  const total = commandMode ? commands.length : movieCount + showCount + episodeCount;

  // Flat, render-ordered list backing arrow-key navigation.
  const flatResults = useMemo<FlatResult[]>(() => {
    if (commandMode) return commands.map((c) => ({ path: c.path }));
    if (!data) return [];
    return [
      ...(data.movies ?? []).map((m) => ({ path: `/movies/${m.id}` })),
      ...(data.shows ?? []).map((s) => ({ path: `/shows/${s.id}` })),
      ...(data.episodes ?? []).map((ep) => ({ path: `/shows/${ep.show_id}` })),
    ];
  }, [commandMode, commands, data]);

  // Reset highlight when the result set changes (no effect → avoids cascading renders).
  const [prevLen, setPrevLen] = useState(flatResults.length);
  if (prevLen !== flatResults.length) {
    setPrevLen(flatResults.length);
    setActiveIndex(0);
  }

  const handleNavigate = useCallback(
    (path: string) => {
      router.push(path);
      onClose();
    },
    [router, onClose],
  );

  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    // Restore focus to whatever triggered the overlay when it closes.
    previouslyFocused.current?.focus?.();
  }, [open]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Focus trap — keep Tab cycling within the dialog.
      if (e.key === "Tab") {
        const root = rootRef.current;
        if (!root) return;
        const focusables = root.querySelectorAll<HTMLElement>(
          'button, input, [href], [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
        return;
      }
      if (flatResults.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % flatResults.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + flatResults.length) % flatResults.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const r = flatResults[activeIndex];
        if (r) handleNavigate(r.path);
      }
    };
    if (open) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose, flatResults, activeIndex, handleNavigate]);

  // Keep the highlighted row in view.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-result-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  const hasResults = total > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] sm:pt-[15vh] px-3 sm:px-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div
        ref={rootRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="relative w-full max-w-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="terminal-scanlines relative rounded-lg shadow-2xl shadow-black/60 overflow-hidden"
          style={{ background: "#08080f", border: "1px solid rgba(139,92,246,0.18)" }}
        >
          <div className="relative z-10 flex flex-col">
            {/* Terminal title bar */}
            <div
              className="flex items-center gap-2.5 px-3.5 h-9 shrink-0"
              style={{ borderBottom: "1px solid #16162a", background: "#06060d" }}
            >
              <div aria-hidden className="flex items-center gap-1.5 shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]/70" />
              </div>
              <span className="font-mono text-[11px] text-white/40 select-none ml-1">
                <span className="text-violet-400/60">jellytics</span>
                <span className="text-white/25"> — </span>
                search
              </span>
              <button
                onClick={onClose}
                className="ml-auto font-mono text-[10px] text-white/30 hover:text-white/60 px-1.5 py-0.5 rounded select-none transition-colors"
                style={{ border: "1px solid #16162a" }}
              >
                esc
              </button>
            </div>

            {/* Shell prompt input */}
            <div
              className="flex items-center gap-2 px-3.5 py-3"
              style={{ borderBottom: "1px solid #16162a" }}
            >
              <span className="font-mono text-sm text-violet-400/70 select-none shrink-0">
                {commandMode ? "~/cmd" : "~/search"}
              </span>
              <span className="font-mono text-base text-violet-400 phosphor-glow select-none shrink-0 -ml-0.5">
                ❯
              </span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="search… or > for commands"
                spellCheck={false}
                autoComplete="off"
                className="flex-1 min-w-0 bg-transparent font-mono text-sm text-white/90 placeholder:text-white/25 caret-violet-400 outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="text-white/30 hover:text-white/70 transition-colors shrink-0"
                  aria-label="Clear"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Command-palette output */}
            {commandMode && (
              <div ref={listRef} className="max-h-[420px] overflow-y-auto py-1.5">
                {commands.length === 0 ? (
                  <p className="px-4 py-3 font-mono text-sm text-white/35">
                    <span className="text-red-400/60">!</span> no commands match{" "}
                    <span className="text-white/60">&quot;{commandQuery}&quot;</span>
                  </p>
                ) : (
                  <ResultSection
                    title="commands"
                    count={commands.length}
                    icon={<CornerDownLeft className="h-3 w-3" />}
                  >
                    {commands.map((c, i) => {
                      const Icon = c.icon;
                      const active = activeIndex === i;
                      return (
                        <button
                          key={c.path}
                          data-result-index={i}
                          onClick={() => handleNavigate(c.path)}
                          onMouseEnter={() => setActiveIndex(i)}
                          className={cn(
                            "group w-full flex items-center gap-3 px-3.5 py-2 text-left font-mono transition-colors relative",
                            active ? "terminal-active-item" : "hover:bg-[#0d0d1a]",
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "shrink-0 w-2 text-center text-xs select-none transition-colors",
                              active ? "text-violet-400 phosphor-glow" : "text-transparent",
                            )}
                          >
                            ❯
                          </span>
                          <Icon
                            className={cn(
                              "h-4 w-4 shrink-0 transition-colors",
                              active ? "text-violet-300" : "text-white/40",
                            )}
                          />
                          <span
                            className={cn(
                              "flex-1 text-sm truncate transition-colors",
                              active ? "text-violet-100" : "text-white/85 group-hover:text-white",
                            )}
                          >
                            {c.label}
                          </span>
                        </button>
                      );
                    })}
                  </ResultSection>
                )}
              </div>
            )}

            {/* Output */}
            {!commandMode && query.length >= 2 && (
              <div ref={listRef} className="max-h-[420px] overflow-y-auto py-1.5">
                {isFetching && !data && (
                  <p className="px-4 py-3 font-mono text-sm text-white/35">
                    <span className="text-violet-400/60">$</span> searching
                    <span className="cursor-blink">_</span>
                  </p>
                )}

                {data && !hasResults && (
                  <p className="px-4 py-3 font-mono text-sm text-white/35">
                    <span className="text-red-400/60">!</span> no matches for{" "}
                    <span className="text-white/60">&quot;{query}&quot;</span>
                  </p>
                )}

                {movieCount > 0 && (
                  <ResultSection
                    title="movies"
                    count={movieCount}
                    icon={<Film className="h-3 w-3" />}
                  >
                    {data!.movies.map((m, i) => (
                      <ResultRow
                        key={m.id}
                        index={i}
                        active={activeIndex === i}
                        onActivate={setActiveIndex}
                        tag="mov"
                        title={m.title}
                        subtitle={m.year?.toString()}
                        posterUrl={m.jellyfin_id ? getMoviePosterUrl(m.jellyfin_id) : undefined}
                        type="movie"
                        onClick={() => handleNavigate(`/movies/${m.id}`)}
                      />
                    ))}
                  </ResultSection>
                )}

                {showCount > 0 && (
                  <ResultSection title="shows" count={showCount} icon={<Tv className="h-3 w-3" />}>
                    {data!.shows.map((s, i) => {
                      const idx = movieCount + i;
                      return (
                        <ResultRow
                          key={s.id}
                          index={idx}
                          active={activeIndex === idx}
                          onActivate={setActiveIndex}
                          tag="tv"
                          title={s.title}
                          subtitle={s.year?.toString()}
                          posterUrl={s.jellyfin_id ? getShowPosterUrl(s.jellyfin_id) : undefined}
                          type="show"
                          onClick={() => handleNavigate(`/shows/${s.id}`)}
                        />
                      );
                    })}
                  </ResultSection>
                )}

                {episodeCount > 0 && (
                  <ResultSection
                    title="episodes"
                    count={episodeCount}
                    icon={<PlayCircle className="h-3 w-3" />}
                  >
                    {data!.episodes.map((ep, i) => {
                      const idx = movieCount + showCount + i;
                      return (
                        <ResultRow
                          key={ep.id}
                          index={idx}
                          active={activeIndex === idx}
                          onActivate={setActiveIndex}
                          tag="ep"
                          title={ep.title || `Episode ${ep.episode_number}`}
                          subtitle={`${ep.show_title} · S${ep.season_number}E${ep.episode_number}`}
                          posterUrl={
                            ep.show_jellyfin_id ? getShowPosterUrl(ep.show_jellyfin_id) : undefined
                          }
                          type="show"
                          onClick={() => handleNavigate(`/shows/${ep.show_id}`)}
                        />
                      );
                    })}
                  </ResultSection>
                )}
              </div>
            )}

            {!commandMode && query.length < 2 && (
              <div className="px-4 py-5 font-mono text-sm text-white/30 flex items-center gap-2">
                <span className="text-violet-400/50">$</span>
                <span>
                  type a query to begin
                  <span className="text-white/20"> · </span>
                  <span className="text-violet-400/60">&gt;</span> for commands
                </span>
                <span className="cursor-blink text-violet-400/70">_</span>
              </div>
            )}

            {/* Vim-style status bar */}
            <div
              className="flex items-center gap-3 px-3 py-1.5 font-mono select-none"
              style={{ background: "#5b21b6", borderTop: "1px solid rgba(139,92,246,0.3)" }}
            >
              <span className="text-[10px] text-white/85">
                {commandMode
                  ? `${total} command${total === 1 ? "" : "s"}`
                  : query.length >= 2
                    ? `${total} match${total === 1 ? "" : "es"}`
                    : "ready"}
              </span>
              <span className="ml-auto flex items-center gap-2.5 text-[10px] text-white/55">
                <span>
                  <span className="text-white/85">↑↓</span> select
                </span>
                <span>
                  <span className="text-white/85">↵</span> open
                </span>
                <span>
                  <span className="text-white/85">esc</span> close
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultSection({
  title,
  count,
  icon,
  children,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 px-3.5 py-1.5">
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-violet-400/55 tracking-[0.15em] uppercase select-none">
          <span className="text-violet-400/35">#</span>
          {icon}
          {title}
          <span className="text-violet-400/30">[{count}]</span>
        </span>
        <div
          className="flex-1 h-px"
          style={{ background: "linear-gradient(90deg, #16162a 60%, transparent)" }}
        />
      </div>
      {children}
    </div>
  );
}

function ResultRow({
  index,
  active,
  onActivate,
  tag,
  title,
  subtitle,
  posterUrl,
  type = "movie",
  onClick,
}: {
  index: number;
  active: boolean;
  onActivate: (index: number) => void;
  tag: string;
  title: string;
  subtitle?: string;
  posterUrl?: string;
  type?: "movie" | "show";
  onClick: () => void;
}) {
  return (
    <button
      data-result-index={index}
      onClick={onClick}
      onMouseEnter={() => onActivate(index)}
      className={cn(
        "group w-full flex items-center gap-3 px-3.5 py-2 text-left font-mono transition-colors relative",
        active ? "terminal-active-item" : "hover:bg-[#0d0d1a]",
      )}
    >
      {/* Prompt marker */}
      <span
        className={cn(
          "shrink-0 w-2 text-center text-xs select-none transition-colors",
          active ? "text-violet-400 phosphor-glow" : "text-transparent",
        )}
      >
        ❯
      </span>

      <div className="relative w-9 h-[54px] shrink-0 rounded-sm overflow-hidden bg-[#0a0a14] border border-[#16162a]">
        <PosterImage
          src={posterUrl}
          alt={title}
          type={type}
          className="object-cover"
          sizes="36px"
          iconSize="h-4 w-4"
          showLabel={false}
        />
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm truncate transition-colors",
            active ? "text-violet-100" : "text-white/85 group-hover:text-white",
          )}
        >
          {title}
        </p>
        {subtitle && <p className="text-xs text-white/35 truncate">{subtitle}</p>}
      </div>

      <span
        className="shrink-0 text-[10px] text-white/25 px-1.5 py-0.5 rounded select-none"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #16162a" }}
      >
        {tag}
      </span>
    </button>
  );
}
