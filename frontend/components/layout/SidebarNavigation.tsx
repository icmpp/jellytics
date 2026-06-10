"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Tv,
  Film,
  BarChart3,
  Settings,
  LogOut,
  History,
  Bookmark,
  Archive,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Search,
  FolderPlus,
} from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useSidebar } from "./SidebarContext";
import { JellyticsLogo } from "./JellyticsLogo";
import { SidebarTooltip } from "./SidebarTooltip";
import { useBackendHealth } from "@/hooks/useBackendHealth";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  idx: string;
}

interface SidebarNavigationProps {
  onSearchClick?: () => void;
}

const subscribe = () => () => {};
const isMacSnapshot = () => /mac|iphone|ipad|ipod/i.test(navigator.platform);

const navItems: NavItem[] = [
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

export function SidebarNavigation({ onSearchClick }: SidebarNavigationProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMac = useSyncExternalStore(subscribe, isMacSnapshot, () => false);
  const backendOnline = useBackendHealth();

  const searchHint = isMac ? "⌘K" : "Ctrl K";

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (mobileOpen) setMobileOpen(false);
  }

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const activeItem = navItems.find(
    (item) =>
      pathname === item.href ||
      (item.href !== "/dashboard" && pathname?.startsWith(item.href + "/")),
  );

  return (
    <>
      {/* Mobile top bar */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-3 sm:px-4 gap-2"
        style={{
          minHeight: "calc(3.5rem + env(safe-area-inset-top, 0px))",
          paddingTop: "env(safe-area-inset-top)",
          background: "#06060d",
          borderBottom: "1px solid #16162a",
        }}
      >
        {/* Terminal window chrome */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]/70" />
          </div>
          <span className="font-mono text-xs text-violet-400/50 select-none">jellytics</span>
          <span className="font-mono text-xs text-white/30">~/</span>
          <span className="font-mono text-xs text-white/50">{activeItem?.label ?? "app"}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <NotificationBell />
          {onSearchClick && (
            <button
              onClick={onSearchClick}
              className="w-8 h-8 flex items-center justify-center rounded text-white/30 hover:text-violet-400 transition-colors tap-target"
              style={{ background: "#0d0d1a", border: "1px solid #16162a" }}
              aria-label="Search"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="w-8 h-8 flex items-center justify-center rounded text-white/30 hover:text-violet-400 transition-colors tap-target"
            style={{ background: "#0d0d1a", border: "1px solid #16162a" }}
            aria-label="Open menu"
          >
            {mobileOpen ? <X className="h-3.5 w-3.5" /> : <Menu className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "terminal-scanlines fixed top-0 left-0 z-50 h-screen flex flex-col transition-all duration-300 overflow-hidden",
          isCollapsed ? "w-[60px]" : "w-60",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
        style={{
          background: "#06060d",
          borderRight: "1px solid #16162a",
        }}
      >
        {/* All content sits above the scanline pseudo-element */}
        <div className="relative z-10 flex flex-col h-full">
          {/* Terminal title bar */}
          <div
            className={cn(
              "shrink-0 flex items-center",
              isCollapsed ? "h-14 justify-center px-2" : "h-[60px] px-3.5 gap-3",
            )}
            style={{ borderBottom: "1px solid #16162a" }}
          >
            {isCollapsed ? (
              <JellyticsLogo size={26} />
            ) : (
              <>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]/70" />
                </div>
                <div className="flex flex-col min-w-0 font-mono ml-0.5">
                  <span className="text-xs font-semibold tracking-widest text-violet-300 leading-tight uppercase">
                    jellytics
                  </span>
                  <span className="text-[11px] tracking-[0.2em] text-violet-400/60 mt-0.5">
                    ~/media
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Desktop search trigger — command-palette affordance (expanded only) */}
          {onSearchClick && !isCollapsed && (
            <div className="hidden md:block px-1.5 pt-2">
              <button
                onClick={onSearchClick}
                className="group w-full flex items-center gap-2 rounded-sm font-mono transition-colors text-white/45 hover:text-white/80 px-2 py-[7px] text-sm"
                style={{ background: "#0a0a14", border: "1px solid #16162a" }}
                aria-label="Search"
              >
                <Search className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                <span className="flex-1 text-left text-white/45 group-hover:text-white/70 transition-colors">
                  search...
                </span>
                <kbd
                  className="text-[10px] text-violet-300/70 px-1.5 py-0.5 rounded select-none"
                  style={{
                    background: "rgba(139,92,246,0.12)",
                    border: "1px solid rgba(139,92,246,0.2)",
                  }}
                >
                  {searchHint}
                </kbd>
              </button>
            </div>
          )}

          {/* Navigation section */}
          {!isCollapsed && (
            <div className="px-3.5 pt-3 pb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-violet-400/55 tracking-[0.25em] uppercase select-none">
                  # navigation
                </span>
                <div
                  className="flex-1 h-px"
                  style={{ background: "linear-gradient(90deg, #16162a 60%, transparent)" }}
                />
              </div>
            </div>
          )}

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-1 px-1.5">
            <div className="space-y-px">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname?.startsWith(item.href + "/"));

                return (
                  <SidebarTooltip
                    key={item.href}
                    label={item.label}
                    hint={item.idx}
                    enabled={isCollapsed}
                  >
                    <Link href={item.href} onClick={() => setMobileOpen(false)}>
                      <div
                        className={cn(
                          "group flex items-center gap-2 text-sm font-mono relative rounded-sm",
                          isCollapsed ? "justify-center h-10 w-full" : "px-2 py-[7px]",
                          !isActive && "hover:bg-[#0d0d1a] transition-colors",
                        )}
                      >
                        {/* Sliding active background (expanded) */}
                        {isActive && !isCollapsed && (
                          <motion.div
                            layoutId="sidebar-active-expanded"
                            className="absolute inset-0 rounded-sm z-0"
                            style={{
                              background:
                                "linear-gradient(90deg, rgba(139,92,246,0.12) 0%, rgba(139,92,246,0.03) 100%)",
                              boxShadow: "inset 3px 0 0 #8b5cf6",
                            }}
                            transition={{ type: "spring", stiffness: 500, damping: 38 }}
                          />
                        )}

                        {/* Sliding active bar (collapsed) */}
                        {isActive && isCollapsed && (
                          <motion.div
                            layoutId="sidebar-active-collapsed"
                            className="absolute left-0 top-1/2 -mt-2.5 w-[3px] h-5 rounded-r z-0"
                            style={{
                              background: "#8b5cf6",
                              boxShadow: "2px 0 8px rgba(139,92,246,0.5)",
                            }}
                            transition={{ type: "spring", stiffness: 500, damping: 38 }}
                          />
                        )}

                        {/* Prompt / dot indicator */}
                        {!isCollapsed && (
                          <span
                            className={cn(
                              "relative z-10 shrink-0 w-3 text-center text-xs select-none transition-colors",
                              isActive
                                ? "text-violet-400 phosphor-glow"
                                : "text-violet-400/35 group-hover:text-violet-400/60",
                            )}
                          >
                            {isActive ? ">" : "·"}
                          </span>
                        )}

                        <Icon
                          className={cn(
                            "relative z-10 shrink-0 transition-[color,transform]",
                            isCollapsed ? "h-[18px] w-[18px]" : "h-4 w-4",
                            isActive
                              ? "text-violet-300"
                              : "text-white/35 group-hover:text-white/65 group-hover:translate-x-0.5",
                          )}
                        />

                        {!isCollapsed && (
                          <>
                            <span
                              className={cn(
                                "relative z-10 flex-1 transition-[color,transform]",
                                isActive
                                  ? "text-violet-200 phosphor-glow"
                                  : "text-white/60 group-hover:text-white/90 group-hover:translate-x-0.5",
                              )}
                            >
                              {item.label}
                              {isActive && (
                                <span className="cursor-blink ml-px text-violet-400/80">_</span>
                              )}
                            </span>
                            {!isActive && (
                              <span className="relative z-10 text-[10px] font-mono text-white/20 group-hover:text-white/35 transition-colors select-none">
                                {item.idx}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </Link>
                  </SidebarTooltip>
                );
              })}
            </div>
          </nav>

          {/* System section footer */}
          <div style={{ borderTop: "1px solid #16162a" }}>
            {!isCollapsed && (
              <div className="px-3.5 pt-2.5 pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-violet-400/55 tracking-[0.25em] uppercase select-none">
                    # system
                  </span>
                  <div
                    className="flex-1 h-px"
                    style={{ background: "linear-gradient(90deg, #16162a 60%, transparent)" }}
                  />
                </div>
              </div>
            )}

            <div className={cn("space-y-0.5", isCollapsed ? "px-1 pb-1 pt-1" : "px-2 pb-2")}>
              {/* User info */}
              {!isCollapsed && user && (
                <div
                  className="mb-1.5 px-3 py-2.5 font-mono rounded-sm"
                  style={{ background: "rgba(139,92,246,0.04)", border: "1px solid #16162a" }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-violet-400/60 select-none">@</span>
                    <span className="text-sm text-violet-200/80 truncate">{user.username}</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        {backendOnline && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400/50" />
                        )}
                        <span
                          className={cn(
                            "relative inline-flex h-2 w-2 rounded-full",
                            backendOnline ? "bg-green-400/80" : "bg-red-500/80",
                          )}
                        />
                      </span>
                      <span
                        className={cn(
                          "font-mono text-xs",
                          backendOnline ? "text-green-400/70" : "text-red-400/80",
                        )}
                      >
                        {backendOnline ? "online" : "offline"}
                      </span>
                    </span>
                  </div>
                </div>
              )}

              <SidebarTooltip label="notifications" enabled={isCollapsed}>
                <NotificationBell
                  side="right"
                  align="end"
                  sideOffset={20}
                  triggerClassName={cn(
                    "hidden md:flex w-full rounded-sm text-sm font-mono transition-colors hover:bg-[#0d0d1a]",
                    isCollapsed
                      ? "h-10 items-center justify-center text-white/45 hover:text-white/75"
                      : "items-center gap-3 px-3 py-2 text-white/50 hover:text-white/80",
                  )}
                  label={isCollapsed ? undefined : "notifications"}
                />
              </SidebarTooltip>

              <SidebarTooltip label="expand" enabled={isCollapsed}>
                <button
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className={cn(
                    "hidden md:flex w-full rounded-sm text-sm font-mono text-white/40 hover:text-white/70 hover:bg-[#0d0d1a] transition-colors",
                    isCollapsed
                      ? "h-10 items-center justify-center"
                      : "items-center gap-3 px-3 py-2",
                  )}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-[18px] w-[18px]" />
                  ) : (
                    <>
                      <span className="w-3 text-center text-xs text-violet-400/40 select-none">
                        ·
                      </span>
                      <ChevronLeft className="h-4 w-4" />
                      <span>collapse</span>
                    </>
                  )}
                </button>
              </SidebarTooltip>

              <SidebarTooltip label="exit session" enabled={isCollapsed}>
                <button
                  onClick={handleLogout}
                  className={cn(
                    "group w-full flex rounded-sm text-sm font-mono text-red-400/55 hover:text-red-400 hover:bg-red-500/6 transition-colors",
                    isCollapsed
                      ? "h-10 items-center justify-center"
                      : "items-center gap-3 px-3 py-2",
                  )}
                >
                  {!isCollapsed && (
                    <span className="w-3 text-center text-xs text-red-400/35 group-hover:text-red-400/60 select-none">
                      ·
                    </span>
                  )}
                  <LogOut className={cn(isCollapsed ? "h-[18px] w-[18px]" : "h-4 w-4")} />
                  {!isCollapsed && <span>exit session</span>}
                </button>
              </SidebarTooltip>
            </div>

            {/* Vim-style status bar */}
            <div
              className={cn(
                "font-mono select-none",
                isCollapsed ? "py-1.5 flex items-center justify-center" : "px-2.5 py-1.5",
              )}
              style={{ background: "#5b21b6", borderTop: "1px solid rgba(139,92,246,0.3)" }}
            >
              {isCollapsed ? (
                <span className="text-[11px] text-white/90 font-bold tracking-widest uppercase">
                  N
                </span>
              ) : (
                <div className="flex items-center gap-0">
                  <span
                    className="text-[11px] text-white font-bold tracking-widest uppercase px-2 py-0.5 mr-2"
                    style={{ background: "rgba(255,255,255,0.15)", borderRadius: "2px" }}
                  >
                    NORMAL
                  </span>
                  <span className="text-[11px] text-white/40 mr-2">│</span>
                  <span className="text-[11px] text-white/75 truncate flex-1">
                    {activeItem?.label ?? "~"}
                  </span>
                  <span className="text-[10px] text-white/35 ml-auto">jellytics</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
