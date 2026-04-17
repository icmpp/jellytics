"use client";

import { SidebarNavigation } from "./SidebarNavigation";
import { SidebarProvider, useSidebar } from "./SidebarContext";
import { GlobalSearch } from "@/components/navigation/GlobalSearch";
import { useAuth } from "@/hooks/useAuth";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface AppLayoutProps {
  children: React.ReactNode;
}

function AppLayoutContent({ children }: AppLayoutProps) {
  const { isCollapsed } = useSidebar();
  const [isMobile, setIsMobile] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useKeyboardShortcuts(() => setSearchOpen(true));

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <div className="min-h-screen bg-app-shell">
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <SidebarNavigation onSearchClick={() => setSearchOpen(true)} />
      <main
        id="main-content"
        className={cn(
          "min-h-dvh transition-all duration-300 flex flex-col overflow-x-clip",
          isMobile
            ? "pt-[calc(3.5rem+env(safe-area-inset-top,0px)+1rem)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            : "px-0 py-0",
          !isMobile && (isCollapsed ? "ml-[72px]" : "ml-64"),
        )}
      >
        <div
          className={cn(
            "flex-1 min-h-0 w-full max-w-full min-w-0",
            !isMobile && "px-6 py-6 md:px-8 md:py-8",
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isHydrated, setIsHydrated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsHydrated(true);
      setIsChecking(false);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const hasToken =
    isAuthenticated || (typeof window !== "undefined" && !!localStorage.getItem("access_token"));

  useEffect(() => {
    if (!isHydrated || isChecking) return;
    if (!hasToken && pathname !== "/login") {
      router.replace("/login");
    }
  }, [hasToken, isHydrated, isChecking, router, pathname]);

  if (!isHydrated || isChecking) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(to bottom, #0a0a0f, #0d0d14)" }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (!hasToken) {
    return null;
  }

  return (
    <SidebarProvider>
      <AppLayoutContent>{children}</AppLayoutContent>
    </SidebarProvider>
  );
}
