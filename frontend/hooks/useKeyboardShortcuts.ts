"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useKeyboardShortcuts(onSearchOpen?: () => void) {
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        onSearchOpen?.();
      }

      if (e.key === "Escape" && window.history.length > 1) {
        router.back();
      }

      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        // Reserved for future help modal
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, onSearchOpen]);
}
