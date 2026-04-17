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
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm overflow-hidden">
      <ol className="flex items-center gap-1.5 list-none m-0 p-0">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          const isCurrentPage = !item.href && isLast;

          return (
            <li
              key={i}
              className={cn(
                "flex items-center gap-1.5",
                isCurrentPage ? "min-w-0 overflow-hidden" : "shrink-0",
              )}
            >
              {i > 0 && <ChevronRight className="h-3 w-3 text-white/20 shrink-0" />}

              {item.icon === "home" && item.href ? (
                <Link
                  href={item.href}
                  className={cn(
                    "group relative flex items-center justify-center",
                    "w-7 h-7 rounded-md",
                    "bg-white/4 hover:bg-purple-500/15",
                    "border border-white/6 hover:border-purple-500/30",
                    "text-white/40 hover:text-purple-400",
                    "transition-all duration-200",
                  )}
                  aria-label="Home"
                >
                  <Home className="h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110" />
                </Link>
              ) : item.href ? (
                <Link
                  href={item.href}
                  className={cn(
                    "px-2 py-1 rounded-md",
                    "text-white/45 hover:text-white/90",
                    "hover:bg-white/6",
                    "transition-all duration-200",
                    "truncate",
                  )}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    "px-2 py-1 rounded-md",
                    "text-white/70 font-medium",
                    "bg-white/4",
                    isCurrentPage && "truncate max-w-[220px] sm:max-w-none",
                  )}
                  title={isCurrentPage ? item.label : undefined}
                  aria-current={isCurrentPage ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
