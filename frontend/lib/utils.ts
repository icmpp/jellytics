import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { API_BASE_URL } from "./api";

/** Shared grid class for media card layouts (movies, shows, watchlist, archive). */
export const MEDIA_GRID_CLASS =
  "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 [&>*]:min-w-0 items-stretch";

/** Grid for collections (fewer columns, text-heavy cards). */
export const COLLECTIONS_GRID_CLASS =
  "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 [&>*]:min-w-0 items-stretch";

/** Base card shell: rounded, blurred bg, border, hover. Add layout classes (flex, group, etc.) as needed. */
export const MEDIA_CARD_BASE =
  "rounded-2xl overflow-hidden backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.12] transition-all";

/** Poster image container (relative, aspect 2:3, rounded). Use for detail pages and card posters. */
export const MEDIA_POSTER_CONTAINER =
  "relative aspect-[2/3] w-full overflow-hidden rounded-2xl backdrop-blur-xl bg-white/[0.03] border border-white/[0.08]";

/** Progress bar track. Child fill uses style={{ width: `${percent}%` }} and bg-gradient-to-r. */
export const PROGRESS_BAR_CLASS =
  "w-full bg-white/10 rounded-full h-1.5 overflow-hidden";

/** Media card title (h3). Add group-hover:text-purple-400 for link cards. */
export const MEDIA_CARD_TITLE_CLASS =
  "media-card-title font-semibold text-white line-clamp-2 mb-2 text-sm min-w-0";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Base URL for API (without trailing path). Used to resolve relative image paths. */
export function getApiOrigin(): string {
  const base = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
  return base || "http://localhost:8080";
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
  itemType?: "movie" | "show" | "episode"
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

/** Returns display text for watch status. Movies show "Watched X time(s)" when count > 0; shows use "Completed". */
export function getWatchStatusText(
  status: "watched" | "watching" | "pending",
  options?: { watchCount?: number; mediaType?: "movie" | "show" }
): string {
  if (status === "watched") {
    if (options?.mediaType === "movie" && (options?.watchCount ?? 0) > 0) {
      const c = options.watchCount!;
      return `Watched ${c} time${c !== 1 ? "s" : ""}`;
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
    console.warn("Failed to parse genre JSON, using raw string:", err)
    return [genre]
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
