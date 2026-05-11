"use client";

import { CheckCircle2, Play, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface CardStatusBadgeProps {
  status: "watched" | "watching" | "pending";
  className?: string;
}

const CONFIG: Record<
  CardStatusBadgeProps["status"],
  { icon: React.ComponentType<{ className?: string }>; label: string; bg: string; fg: string }
> = {
  watched: {
    icon: CheckCircle2,
    label: "Watched",
    bg: "bg-emerald-500/85 shadow-[0_0_20px_-4px_rgba(16,185,129,0.55)]",
    fg: "text-white",
  },
  watching: {
    icon: Play,
    label: "Currently watching",
    bg: "bg-primary/90 shadow-lg shadow-violet-600/35",
    fg: "text-primary-foreground",
  },
  pending: {
    icon: Clock,
    label: "Not watched",
    bg: "bg-black/55 backdrop-blur-md",
    fg: "text-white/75",
  },
};

export function CardStatusBadge({ status, className }: CardStatusBadgeProps) {
  const { icon: Icon, label, bg, fg } = CONFIG[status];
  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      className={cn(
        "absolute right-2 top-2 z-10",
        "flex h-7 w-7 items-center justify-center rounded-full",
        "ring-1 ring-white/15 ring-offset-1 ring-offset-black/20",
        "shadow-lg shadow-black/40",
        bg,
        fg,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}
