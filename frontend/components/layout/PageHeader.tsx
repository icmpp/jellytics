"use client";

import { Breadcrumb, type BreadcrumbItem } from "@/components/navigation";

export type { BreadcrumbItem };

interface PageHeaderProps {
  breadcrumb?: BreadcrumbItem[];
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  sticky?: boolean;
}

export function PageHeader({
  breadcrumb,
  title,
  description,
  icon,
  actions,
  sticky = true,
}: PageHeaderProps) {
  const inner = (
    <div className="min-w-0">
      {breadcrumb && breadcrumb.length > 0 && (
        <div className="mb-2">
          <Breadcrumb items={breadcrumb} />
        </div>
      )}

      <div className="flex min-w-0 items-center justify-between gap-3">
        <h1 className="flex min-w-0 items-center gap-2 text-xl font-bold text-white sm:text-2xl">
          {icon && <span className="shrink-0">{icon}</span>}
          <span className="truncate">{title}</span>
        </h1>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      {description && <p className="mt-1 text-sm leading-snug text-white/40">{description}</p>}
    </div>
  );

  if (!sticky) return inner;

  return (
    <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] md:top-0 z-10 -mx-4 px-4 md:-mx-8 md:px-8 pt-4 pb-4 bg-[#0d0d14] border-b border-white/6">
      {inner}
    </div>
  );
}
