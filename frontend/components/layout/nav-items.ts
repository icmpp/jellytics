import {
  LayoutDashboard,
  Tv,
  Film,
  BarChart3,
  Settings,
  History,
  Bookmark,
  Archive,
  FolderPlus,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  idx: string;
}

/**
 * Canonical sidebar navigation list. Single source of truth — consumed by
 * SidebarNavigation (rendering) and useKeyboardShortcuts (Cmd/Ctrl+1..9 jump).
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "dashboard", icon: LayoutDashboard, idx: "01" },
  { href: "/shows", label: "shows", icon: Tv, idx: "02" },
  { href: "/movies", label: "movies", icon: Film, idx: "03" },
  { href: "/watchlist", label: "watchlist", icon: Bookmark, idx: "04" },
  { href: "/collections", label: "collections", icon: FolderPlus, idx: "05" },
  { href: "/history", label: "history", icon: History, idx: "06" },
  { href: "/archive", label: "archive", icon: Archive, idx: "07" },
  { href: "/stats", label: "statistics", icon: BarChart3, idx: "08" },
  { href: "/settings", label: "settings", icon: Settings, idx: "09" },
];

/**
 * Whether `href` is the active route for the current `pathname`.
 * Exact match, or a nested route (e.g. /shows/123) — except /dashboard which
 * only matches exactly so it isn't treated as a parent of every route.
 */
export function isRouteActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));
}
