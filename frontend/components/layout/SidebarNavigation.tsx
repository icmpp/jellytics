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
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSidebar } from "./SidebarContext";
import { JellyticsLogo } from "./JellyticsLogo";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface SidebarNavigationProps {
  onSearchClick?: () => void;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/shows", label: "Shows", icon: Tv },
  { href: "/movies", label: "Movies", icon: Film },
  { href: "/watchlist", label: "Watchlist", icon: Bookmark },
  { href: "/collections", label: "Collections", icon: FolderPlus },
  { href: "/history", label: "History", icon: History },
  { href: "/archive", label: "Archive", icon: Archive },
  { href: "/stats", label: "Statistics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SidebarNavigation({ onSearchClick }: SidebarNavigationProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const [mobileOpen, setMobileOpen] = useState(false);

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (mobileOpen) setMobileOpen(false);
  }

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <>
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-50 min-h-14 pt-[env(safe-area-inset-top)] backdrop-blur-xl bg-white/2 border-b border-white/6 flex items-center justify-between px-3 sm:px-4 gap-2"
        style={{ minHeight: "calc(3.5rem + env(safe-area-inset-top, 0px))" }}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <JellyticsLogo size={30} />
          <span className="font-semibold tracking-tight text-[15px]">
            <span className="text-white">Jelly</span>
            <span className="text-white/40">tics</span>
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <NotificationBell />
          {onSearchClick && (
            <button
              onClick={onSearchClick}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/8 text-white/70 hover:text-white hover:bg-white/8 transition-all tap-target"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/8 text-white/70 hover:text-white hover:bg-white/8 transition-all tap-target"
            aria-label="Open menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-screen backdrop-blur-xl bg-white/2 border-r border-white/6 flex flex-col transition-all duration-300",
          isCollapsed ? "w-[72px]" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div
          className={cn(
            "shrink-0 border-b border-white/6",
            isCollapsed
              ? "h-16 flex items-center justify-center px-3"
              : "h-[72px] flex items-center gap-3 px-4",
          )}
        >
          <JellyticsLogo size={36} />
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-[15px] font-bold tracking-tight text-white leading-tight">
                Jellytics
              </span>
              <span className="text-[10px] font-semibold tracking-[0.12em] text-violet-400/60 uppercase mt-0.5">
                Media Analytics
              </span>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname?.startsWith(item.href + "/"));

              return (
                <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                      isActive
                        ? "bg-purple-500/20 text-white border border-purple-500/30 shadow-lg shadow-purple-500/10"
                        : "text-white/50 hover:text-white hover:bg-white/5 border border-transparent",
                      isCollapsed && "justify-center px-0",
                    )}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-purple-400")} />
                    {!isCollapsed && <span>{item.label}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="p-3 space-y-2 border-t border-white/6">
          {!isCollapsed && user && (
            <div className="px-3 py-2 rounded-xl bg-white/3 border border-white/6">
              <p className="text-xs text-white/40 mb-0.5">Signed in as</p>
              <p className="text-sm font-medium text-white truncate">{user.username}</p>
            </div>
          )}

          <NotificationBell
            side="right"
            align="end"
            sideOffset={20}
            triggerClassName={cn(
              "hidden md:flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 border border-transparent transition-all",
              isCollapsed && "justify-center px-0",
            )}
            label={isCollapsed ? undefined : "Notifications"}
          />

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              "hidden md:flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 border border-transparent transition-all",
              isCollapsed && "justify-center px-0",
            )}
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <>
                <ChevronLeft className="h-5 w-5" />
                <span>Collapse</span>
              </>
            )}
          </button>

          <button
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400/80 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all",
              isCollapsed && "justify-center px-0",
            )}
            title={isCollapsed ? "Logout" : undefined}
          >
            <LogOut className="h-5 w-5" />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
