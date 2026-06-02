"use client";

import { useState, useRef, useSyncExternalStore, ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

const subscribe = () => () => {};
const useIsClient = () => useSyncExternalStore(subscribe, () => true, () => false);

interface SidebarTooltipProps {
  label: string;
  /** Small trailing hint rendered as a kbd chip, e.g. "⌘K" or "01". */
  hint?: string;
  /** When false, the tooltip is disabled and children render as-is (e.g. expanded sidebar). */
  enabled?: boolean;
  children: ReactNode;
}

/**
 * Terminal-styled tooltip that renders in a portal with fixed positioning so it
 * escapes the sidebar's `overflow-hidden` (needed for the scanline overlay).
 * Appears to the right of the trigger — used in the collapsed sidebar.
 */
export function SidebarTooltip({ label, hint, enabled = true, children }: SidebarTooltipProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const mounted = useIsClient();

  const show = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({ top: rect.top + rect.height / 2, left: rect.right + 12 });
  };

  const hide = () => setCoords(null);

  if (!enabled) return <>{children}</>;

  return (
    <div
      ref={triggerRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
    >
      {children}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {coords && (
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                role="tooltip"
                className="fixed z-100 pointer-events-none -translate-y-1/2 font-mono"
                style={{ top: coords.top, left: coords.left }}
              >
                <div
                  className="relative flex items-center gap-2 px-2.5 py-1.5 rounded-md shadow-lg shadow-black/40"
                  style={{
                    background: "#0d0d1a",
                    border: "1px solid rgba(139,92,246,0.3)",
                  }}
                >
                  {/* Notch pointing left toward the trigger */}
                  <span
                    className="absolute right-full top-1/2 -translate-y-1/2 -mr-px h-2 w-2 rotate-45"
                    style={{
                      background: "#0d0d1a",
                      borderLeft: "1px solid rgba(139,92,246,0.3)",
                      borderBottom: "1px solid rgba(139,92,246,0.3)",
                    }}
                  />
                  <span className="text-violet-400/70 text-xs select-none">&gt;</span>
                  <span className="text-xs text-white/85 whitespace-nowrap">{label}</span>
                  {hint && (
                    <span
                      className="text-[10px] text-violet-300/70 px-1.5 py-0.5 rounded select-none"
                      style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.2)" }}
                    >
                      {hint}
                    </span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
