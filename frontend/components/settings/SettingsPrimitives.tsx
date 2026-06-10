"use client";

import * as React from "react";
import type { ReactNode } from "react";
import { CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Shared terminal-theme styling for the settings page. Mirrors the canonical
 * tokens (mono, violet accents, #16162a borders, rounded-sm, snake_case labels,
 * `#`/`//` comment prefixes) used across the migrated pages.
 */

/** Terminal-styled <Input> className — pass to the shared Input via `className`. */
export const INPUT_CLASS =
  "rounded-sm border-[#16162a] bg-[#0a0a14] font-mono text-sm focus:border-violet-500/50 focus:bg-[#0d0d1a] focus:ring-violet-500/20";

/** Section-header style card header: muted icon + `# title` + gradient rule + `# description` comment. */
export function SettingsCardHeader({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <CardHeader>
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span className="shrink-0 text-white/25">{icon}</span>}
        <span className="shrink-0 select-none font-mono text-xs text-violet-400/55">#</span>
        <span className="truncate font-mono text-xs uppercase tracking-[0.15em] text-violet-300/70">
          {title}
        </span>
        <div
          className="h-px min-w-4 flex-1"
          style={{ background: "linear-gradient(90deg, #16162a 60%, transparent)" }}
        />
      </div>
      {description && (
        <p className="mt-2 font-mono text-xs leading-snug text-violet-300/55">
          <span className="select-none text-violet-400/45">{"# "}</span>
          {description}
        </p>
      )}
    </CardHeader>
  );
}

/** Small mono field label with a `//` comment prefix. */
export function FieldLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "font-mono text-[10px] uppercase tracking-[0.15em] text-violet-300/55",
        className,
      )}
    >
      <span className="select-none text-violet-400/40">{"// "}</span>
      {children}
    </span>
  );
}

/** Page-level section marker — a `## label` comment with a fading rule, one tier above card headers. */
export function SectionComment({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-0.5">
      <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.25em] text-violet-300/65">
        <span className="select-none text-violet-400/45">{"## "}</span>
        {label}
      </span>
      <div
        className="h-px flex-1"
        style={{
          background:
            "linear-gradient(90deg, rgba(139,92,246,0.25) 0%, #1e1e32 24%, transparent 70%)",
        }}
      />
    </div>
  );
}

/** Labelled horizontal rule used between sub-sections of a card. */
export function SettingsDivider({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-[#16162a]" />
      {label && (
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-violet-400/40">
          {label}
        </span>
      )}
      <div className="h-px flex-1 bg-[#16162a]" />
    </div>
  );
}

type TerminalButtonProps = React.ComponentProps<"button"> & {
  variant?: "primary" | "idle" | "danger";
};

/** Terminal-styled action button (replaces the purple shared Button on this page). */
export const TerminalButton = React.forwardRef<HTMLButtonElement, TerminalButtonProps>(
  function TerminalButton({ variant = "primary", className, children, ...props }, ref) {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex h-11 items-center justify-center gap-2 rounded-sm border px-4 font-mono text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40",
          "[&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
          variant === "primary" &&
            "border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/15",
          variant === "idle" &&
            "border-[#16162a] bg-[#0a0a14] text-white/70 hover:bg-[#0d0d1a] hover:text-white/90",
          variant === "danger" &&
            "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15",
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
