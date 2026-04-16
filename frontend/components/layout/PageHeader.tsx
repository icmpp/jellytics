"use client";

import { Breadcrumb, type BreadcrumbItem } from "@/components/navigation";
import { cn } from "@/lib/utils";

export type { BreadcrumbItem };

interface PageHeaderProps {
  /** Breadcrumb items (optional for pages like dashboard) */
  breadcrumb?: BreadcrumbItem[];
  /** Page title */
  title: string;
  /** Optional description below the title */
  description?: string;
  /** Optional icon to display before the title */
  icon?: React.ReactNode;
  /** Optional actions (e.g. filters, export) — same row as description on larger screens */
  actions?: React.ReactNode;
  /** Whether the header should stick to the top when scrolling. Defaults to true. */
  sticky?: boolean;
}

/**
 * Consistent page header with breadcrumb, title, description, and optional actions.
 * Description and actions sit directly under the title (tight spacing), sharing one row from `sm` up.
 * Sticks to the top when scrolling by default (pass sticky={false} to disable).
 */
export function PageHeader({
  breadcrumb,
  title,
  description,
  icon,
  actions,
  sticky = true,
}: PageHeaderProps) {
  const hasMeta = Boolean(description || actions);

  const inner = (
    <div className="min-w-0">
      {breadcrumb && breadcrumb.length > 0 && (
        <div className="mb-2 sm:mb-3">
          <Breadcrumb items={breadcrumb} />
        </div>
      )}
      <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2 sm:gap-3">
        {icon}
        {title}
      </h1>
      {hasMeta && (
        <div
          className={cn(
            "mt-1.5 sm:mt-2 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-x-4 sm:gap-y-0 md:gap-x-5",
            description && actions && "sm:justify-between",
            !description && actions && "sm:justify-end",
          )}
        >
          {description && (
            <p className="min-w-0 flex-1 text-pretty text-white/50 text-sm leading-snug sm:text-base">
              {description}
            </p>
          )}
          {actions && (
            <div className="flex w-full min-w-0 shrink-0 flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end sm:gap-2.5 md:gap-3">
              {actions}
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (!sticky) return inner;

  return (
    <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] md:top-0 z-10 -mx-4 px-4 md:-mx-8 md:px-8 md:-mt-8 md:pt-8 pb-4 bg-app-shell border-b border-white/6">
      {inner}
    </div>
  );
}
