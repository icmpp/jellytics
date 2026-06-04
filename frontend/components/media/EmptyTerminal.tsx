"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface EmptyTerminalProps {
  /** Path shown in the window title bar, e.g. "watchlist" → "~/watchlist". */
  path: string;
  /** Command typed after the `$ ` prompt. */
  command: React.ReactNode;
  /** Output line rendered under the command, prefixed with `# `. */
  output: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  headline: string;
  subtext?: React.ReactNode;
  /** Mode label shown in the vim-style status bar (e.g. "empty", "no match"). */
  statusLabel: string;
  /** Optional extra body content (e.g. suggested posters, filter pills). */
  children?: React.ReactNode;
  /** Optional action row rendered at the bottom of the body. */
  actions?: React.ReactNode;
}

/**
 * Terminal-window empty state — shared across watchlist, movies, and shows.
 * Reuses the filter-panel chrome and the sidebar's vim status bar.
 */
export function EmptyTerminal({
  path,
  command,
  output,
  icon: Icon,
  headline,
  subtext,
  statusLabel,
  children,
  actions,
}: EmptyTerminalProps) {
  return (
    <div className="flex justify-center py-12 sm:py-16">
      <div className="w-full max-w-lg overflow-hidden rounded-sm border border-[#16162a] bg-[#07070d] shadow-[0_8px_40px_-8px_rgba(0,0,0,0.6)]">
        {/* Terminal window chrome */}
        <div
          className="flex items-center gap-2.5 border-b border-[#16162a] px-4 py-2.5"
          style={{ background: "#06060d" }}
        >
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-[#ef4444]/70" />
            <div className="h-2 w-2 rounded-full bg-[#f59e0b]/70" />
            <div className="h-2 w-2 rounded-full bg-[#22c55e]/70" />
          </div>
          <span className="font-mono text-xs text-violet-400/60">~/{path}</span>
        </div>

        {/* Body */}
        <div className="px-5 py-7 font-mono sm:px-7">
          {/* Simulated command + output */}
          <div className="text-xs leading-relaxed">
            <p className="flex items-center gap-2">
              <span className="select-none text-violet-400 phosphor-glow">$</span>
              <span className="text-white/80">{command}</span>
            </p>
            <p className="mt-1.5 text-white/40">
              <span className="select-none text-violet-400/45">{"# "}</span>
              {output}
            </p>
          </div>

          {/* Icon + headline */}
          <div className="mt-7 flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-sm border border-violet-500/15 bg-violet-500/5">
              <Icon className="h-6 w-6 text-violet-400/60 phosphor-glow" />
            </div>
            <p className="text-sm text-white/75">
              {headline}
              <span className="cursor-blink ml-px text-violet-400/80">_</span>
            </p>
            {subtext && (
              <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-violet-300/45">
                {subtext}
              </p>
            )}
          </div>

          {children}

          {actions && <div className="mt-7 flex flex-wrap justify-center gap-2.5">{actions}</div>}
        </div>

        {/* Vim-style status bar */}
        <div
          className="flex select-none items-center px-2.5 py-1.5 font-mono"
          style={{ background: "#5b21b6", borderTop: "1px solid rgba(139,92,246,0.3)" }}
        >
          <span
            className="mr-2 px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest text-white"
            style={{ background: "rgba(255,255,255,0.15)", borderRadius: "2px" }}
          >
            {statusLabel}
          </span>
          <span className="mr-2 text-[11px] text-white/40">│</span>
          <span className="flex-1 truncate text-[11px] text-white/75">{path}</span>
          <span className="ml-auto text-[10px] text-white/35">jellytics</span>
        </div>
      </div>
    </div>
  );
}

/**
 * A terminal-styled action — renders as a Link when `href` is set, otherwise a button.
 */
export function TerminalAction({
  href,
  onClick,
  icon: Icon,
  label,
  variant = "idle",
  disabled,
}: {
  href?: string;
  onClick?: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  variant?: "idle" | "primary";
  disabled?: boolean;
}) {
  const className = cn(
    "group inline-flex h-9 items-center gap-2 rounded-sm border px-3.5 font-mono text-xs transition-colors",
    variant === "primary"
      ? "border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/15"
      : "border-[#16162a] bg-[#0a0a14] text-white/60 hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-300",
    disabled && "pointer-events-none opacity-50",
  );

  const inner = (
    <>
      {Icon && (
        <Icon className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
      )}
      {label}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {inner}
    </button>
  );
}
