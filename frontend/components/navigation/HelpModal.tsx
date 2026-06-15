"use client";

import { useEffect, useRef } from "react";

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["⌘", "K"], label: "open search / command palette" },
  { keys: ["⌘", "1-9"], label: "jump to sidebar section" },
  { keys: [">"], label: "command mode (inside search)" },
  { keys: ["↑", "↓"], label: "move selection (in search)" },
  { keys: ["↵"], label: "open selection" },
  { keys: ["?"], label: "toggle this help" },
  { keys: ["esc"], label: "close overlay" },
];

export function HelpModal({ open, onClose }: HelpModalProps) {
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      const t = setTimeout(() => closeRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    previouslyFocused.current?.focus?.();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-3 sm:px-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="relative w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="terminal-scanlines relative overflow-hidden rounded-sm shadow-2xl shadow-black/60"
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
                keymap
              </span>
              <button
                ref={closeRef}
                onClick={onClose}
                className="ml-auto font-mono text-[10px] text-white/30 hover:text-white/60 px-1.5 py-0.5 rounded-sm select-none transition-colors"
                style={{ border: "1px solid #16162a" }}
              >
                esc
              </button>
            </div>

            {/* Body */}
            <div className="px-4 py-4 font-mono">
              <p className="mb-3 text-[11px] uppercase tracking-[0.15em] text-violet-400/55 select-none">
                <span className="text-violet-400/40"># </span>keyboard_shortcuts
              </p>
              <ul className="space-y-1.5">
                {SHORTCUTS.map((s) => (
                  <li key={s.label} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-white/65">{s.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {s.keys.map((k) => (
                        <kbd
                          key={k}
                          className="rounded-sm px-1.5 py-0.5 text-[10px] text-violet-300/80 select-none"
                          style={{
                            background: "rgba(139,92,246,0.12)",
                            border: "1px solid rgba(139,92,246,0.2)",
                          }}
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Vim-style status bar */}
            <div
              className="flex items-center px-3 py-1.5 font-mono select-none"
              style={{ background: "#5b21b6", borderTop: "1px solid rgba(139,92,246,0.3)" }}
            >
              <span className="text-[10px] text-white/85">help</span>
              <span className="ml-auto text-[10px] text-white/55">
                <span className="text-white/85">?</span> or{" "}
                <span className="text-white/85">esc</span> to close
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
