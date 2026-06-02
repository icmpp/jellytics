"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Home } from "lucide-react";

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
    <nav aria-label="Breadcrumb" className="flex items-center min-w-0 overflow-hidden">
      <ol className="flex items-center list-none m-0 p-0 min-w-0 font-mono">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          const isCurrentPage = !item.href && isLast;

          return (
            <li
              key={i}
              className={cn(
                "flex items-center",
                isCurrentPage ? "min-w-0 overflow-hidden" : "shrink-0",
              )}
            >
              {i > 0 && (
                <span className="text-violet-400/30 mx-1.5 text-sm shrink-0 select-none">/</span>
              )}

              {item.icon === "home" && item.href ? (
                <Link
                  href={item.href}
                  aria-label="Home"
                  className="flex items-center gap-1 px-1.5 py-1 rounded text-violet-400/60 hover:text-violet-300 hover:bg-violet-500/10 transition-all duration-150 text-sm"
                >
                  <Home className="h-3.5 w-3.5" />
                  <span>~</span>
                </Link>
              ) : item.href ? (
                <Link
                  href={item.href}
                  className="px-1.5 py-1 rounded text-sm text-violet-400/65 hover:text-violet-200 hover:bg-violet-500/10 transition-all duration-150"
                >
                  {item.label?.toLowerCase()}
                </Link>
              ) : (
                <span
                  className={cn(
                    "px-1 text-sm text-white/85 font-medium truncate",
                    isCurrentPage && "max-w-[200px] sm:max-w-[380px]",
                  )}
                  title={isCurrentPage ? item.label : undefined}
                  aria-current={isCurrentPage ? "page" : undefined}
                >
                  {item.label?.toLowerCase()}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
