"use client";

import { Breadcrumb, type BreadcrumbItem } from "@/components/navigation";

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
  /** Optional actions (e.g. filters, export button) to the right */
  actions?: React.ReactNode;
}

/**
 * Consistent page header with breadcrumb, title, description, and optional actions.
 * Ensures uniform spacing and structure across all app pages.
 */
export function PageHeader({ breadcrumb, title, description, icon, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div className="min-w-0 flex-1">
        {breadcrumb && breadcrumb.length > 0 && (
          <div className="mb-3">
            <Breadcrumb items={breadcrumb} />
          </div>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 flex items-center gap-2 sm:gap-3">
          {icon}
          {title}
        </h1>
        {description && <p className="text-white/50 text-sm sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 sm:gap-3 shrink-0">{actions}</div>}
    </div>
  );
}
