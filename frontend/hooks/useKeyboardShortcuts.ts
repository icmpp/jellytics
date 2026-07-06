"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { NAV_ITEMS } from "@/components/layout/nav-items";

/** True when focus is in a text input / textarea / contenteditable. */
function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

interface KeyboardShortcutHandlers {
  onSearchOpen?: () => void;
  onHelpOpen?: () => void;
}

export function useKeyboardShortcuts({ onSearchOpen, onHelpOpen }: KeyboardShortcutHandlers = {}) {
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K — open global search (works even from inputs).
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onSearchOpen?.();
        return;
      }

      // Cmd/Ctrl+1..9 — jump to the matching sidebar route.
      if ((e.ctrlKey || e.metaKey) && /^[1-9]$/.test(e.key)) {
        const target = NAV_ITEMS[Number(e.key) - 1];
        if (target) {
          e.preventDefault();
          router.push(target.href);
        }
        return;
      }

      // The remaining single-key shortcuts must not fire while typing.
      if (isTypingTarget(e.target)) return;

      // `?` — open the keyboard-shortcut help modal.
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onHelpOpen?.();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, onSearchOpen, onHelpOpen]);
}
