import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { API_BASE_URL } from "./api";

/** Shared grid class for media card layouts (movies, shows, watchlist, archive). */
export const MEDIA_GRID_CLASS =
  "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-3.5 lg:gap-4 [&>*]:min-w-0 items-stretch";

/** Grid for collections (fewer columns, text-heavy cards). */
export const COLLECTIONS_GRID_CLASS =
  "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 [&>*]:min-w-0 items-stretch";

/** Base card shell: glass surface, depth, calm hover lift. */
export const MEDIA_CARD_BASE = [
  "rounded-2xl overflow-hidden",
  "border border-white/[0.07]",
  "bg-gradient-to-b from-white/[0.06] to-white/[0.02]",
  "shadow-[0_24px_48px_-12px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.04)_inset]",
  "backdrop-blur-xl",
  "transition-[box-shadow,background-color,border-color,transform] duration-300 ease-out",
  "hover:-translate-y-0.5 hover:border-white/[0.12]",
  "hover:from-white/[0.08] hover:to-white/[0.035]",
  "hover:shadow-[0_28px_56px_-14px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.06)_inset]",
].join(" ");

/** Wraps grid card links (movies/shows) for radius + keyboard focus ring. */
export const MEDIA_CARD_LINK_CLASS = [
  "block h-full min-w-0 rounded-2xl outline-none",
  "transition-shadow duration-300",
  "focus-visible:ring-2 focus-visible:ring-primary/50",
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
].join(" ");

/** Poster image container (relative, aspect 2:3, rounded). Use for detail pages and card posters. */
export const MEDIA_POSTER_CONTAINER =
  "relative aspect-[2/3] w-full overflow-hidden rounded-2xl backdrop-blur-xl bg-white/[0.03] border border-white/[0.08]";

/** Progress bar track. Child sets width; use gradient fill on the inner bar. */
export const PROGRESS_BAR_CLASS =
  "w-full h-1 overflow-hidden rounded-full bg-black/40 ring-1 ring-inset ring-white/[0.06]";

/** Poster frame for grid cards (movies, shows, watchlist, archive). */
export const MEDIA_CARD_POSTER_CLASS =
  "relative isolate aspect-[2/3] w-full shrink-0 overflow-hidden bg-zinc-950";

/** Bottom overlay on poster for progress (movies % watched, shows episode bar). */
export const MEDIA_CARD_POSTER_FOOTER_CLASS = [
  "absolute inset-x-0 bottom-0 z-[2]",
  "border-t border-white/[0.08]",
  "bg-black/50 px-2.5 py-2 backdrop-blur-xl",
].join(" ");

/** Inner column below the poster on library cards. */
export const MEDIA_CARD_BODY_CLASS = "flex min-h-0 flex-1 flex-col gap-1.5 px-3 pb-3 pt-2.5";

/** Year / runtime / tabular facts under the title. */
export const MEDIA_CARD_META_CLASS = [
  "flex flex-wrap items-center gap-x-1.5 gap-y-0",
  "text-[11px] font-medium leading-none tabular-nums tracking-wide",
  "text-white/40",
].join(" ");

/** Watch status / counts row (library cards). */
export const MEDIA_CARD_STAT_ROW_CLASS = [
  "flex items-center justify-between gap-2",
  "text-[11px] font-medium leading-tight tracking-wide text-white/50",
].join(" ");

/**
 * Media card title (h3). Use inside a `group` wrapper (e.g. Link) for hover tint.
 */
export const MEDIA_CARD_TITLE_CLASS = [
  "media-card-title line-clamp-2 min-w-0",
  "text-[0.8125rem] font-semibold leading-snug tracking-tight text-white",
  "transition-colors duration-200 ease-out",
  "group-hover:text-primary",
].join(" ");

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Base URL for API (without trailing path). Used to resolve relative image paths. */
export function getApiOrigin(): string {
  return API_BASE_URL.replace(/\/api\/v1\/?$/, "");
}

/** Resolves a poster URL from the API. Handles both full URLs and relative paths like /api/v1/images/... */
export function resolvePosterUrl(posterUrl: string | undefined): string | undefined {
  if (!posterUrl) return undefined;
  if (posterUrl.startsWith("http://") || posterUrl.startsWith("https://")) {
    return posterUrl;
  }
  const origin = getApiOrigin();
  const path = posterUrl.startsWith("/") ? posterUrl : `/${posterUrl}`;
  return `${origin}${path}`;
}

/** Returns the API URL for a media image served through the local caching proxy. */
export function getImageUrl(
  itemType: "movies" | "shows",
  jellyfinId: string,
  imageType: "poster" | "backdrop" = "poster",
): string {
  if (!jellyfinId) return "";
  return `${API_BASE_URL}/images/${itemType}/${jellyfinId}/${imageType}`;
}

export function getMoviePosterUrl(jellyfinId: string): string {
  return getImageUrl("movies", jellyfinId);
}

export function getShowPosterUrl(jellyfinId: string): string {
  return getImageUrl("shows", jellyfinId);
}

/** Builds the Jellyfin web client URL to open an item. Uses #/details route; serverId required. */
export function buildJellyfinItemUrl(
  serverUrl: string,
  jellyfinId: string,
  serverId?: string,
  itemType?: "movie" | "show" | "episode",
): string {
  const base = serverUrl.replace(/\/$/, "");
  const params = new URLSearchParams();
  params.set("id", jellyfinId);
  if (serverId) params.set("serverId", serverId);
  if (itemType === "show" || itemType === "episode") {
    params.set("context", "tvshows");
  }
  const query = params.toString();
  return `${base}/web/index.html#/details?${query}`;
}

/**
 * Returns display text for watch status.
 * Pass `watchCount` for movies to show "Watched X time(s)" (e.g. detail pages).
 * Omit `watchCount` on cards to show plain "Watched". Shows use "Completed".
 */
export function getWatchStatusText(
  status: "watched" | "watching" | "pending",
  options?: { watchCount?: number; mediaType?: "movie" | "show" },
): string {
  if (status === "watched") {
    if (options?.mediaType === "movie") {
      const c = options.watchCount ?? 0;
      if (c > 0) {
        return `Watched ${c} time${c !== 1 ? "s" : ""}`;
      }
      return "Watched";
    }
    if (options?.mediaType === "show") return "Completed";
    return "Not watched";
  }
  if (status === "watching") return "Currently watching";
  return "Not watched";
}

/** Formats duration in minutes as a human-readable string (e.g. "2h 35m" or "45m"). */
export function formatRuntime(minutes?: number | null): string | null {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/** Parses a genre field that may be a JSON array string or plain string. Always returns string[]. */
export function parseGenres(genre?: string | null): string[] {
  if (!genre) return [];
  try {
    const parsed = JSON.parse(genre);
    if (Array.isArray(parsed)) return parsed;
    return [genre];
  } catch (err) {
    console.warn("Failed to parse genre JSON, using raw string:", err);
    return [genre];
  }
}

export const RECHARTS_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "rgba(20, 20, 30, 0.95)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "12px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
    padding: "12px 16px",
  },
  labelStyle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: "12px",
    marginBottom: "4px",
  },
  itemStyle: { color: "rgba(255,255,255,0.9)", fontSize: "13px" },
} as const;
