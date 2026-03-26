"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
	label?: string;
	href?: string;
	icon?: "home";
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-2 text-sm mb-2 overflow-hidden"
    >
      {items.map((item, i) => {
        const isCurrentPage = !item.href && i === items.length - 1;
        return (
          <span
            key={i}
            className={cn(
              "flex items-center gap-2",
              isCurrentPage ? "min-w-0 overflow-hidden" : "shrink-0"
            )}
          >
            {i > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-white/25 shrink-0" />
            )}
            {item.icon === "home" && item.href ? (
              <Link
                href={item.href}
                className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/50 hover:text-purple-400 hover:bg-purple-500/15 hover:border-purple-500/25 transition-all duration-200 shrink-0"
                aria-label="Home"
              >
                <Home className="h-3.5 w-3.5" />
              </Link>
            ) : item.href ? (
              <Link
                href={item.href}
                className="text-white/50 hover:text-white/80 transition-colors truncate"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  "text-white/60 font-medium",
                  isCurrentPage && "truncate max-w-[160px] sm:max-w-none"
                )}
                title={isCurrentPage ? item.label : undefined}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
