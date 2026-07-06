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
  const pathItems: BreadcrumbItem[] =
    breadcrumb && breadcrumb.length > 0
      ? breadcrumb
      : [{ icon: "home", href: "/dashboard" }, ...(title ? [{ label: title }] : [])];

  const inner = (
    <div className="min-w-0">
      {/* Breadcrumb path */}
      <div className="mb-3 -ml-1.5">
        <Breadcrumb items={pathItems} />
      </div>

      {/* Title row + actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {title && (
            <div className="flex items-center gap-3 min-w-0">
              {icon && <span className="shrink-0 text-violet-400/70">{icon}</span>}
              <span
                className="text-violet-400 text-base font-mono shrink-0 select-none phosphor-glow"
                aria-hidden="true"
              >
                {">"}
              </span>
              <h1 className="text-2xl sm:text-3xl font-mono font-semibold text-white truncate leading-tight">
                {title}
              </h1>
              <span className="cursor-blink text-violet-400/60 text-2xl leading-tight shrink-0 select-none">
                _
              </span>
            </div>
          )}

          {description && (
            <p className="mt-2 text-xs font-mono leading-snug text-violet-300/55">
              <span className="text-violet-400/45 select-none">{"# "}</span>
              {description}
            </p>
          )}
        </div>

        {actions && <div className="flex shrink-0 items-center gap-2 pt-0.5">{actions}</div>}
      </div>
    </div>
  );

  if (!sticky) {
    return <div>{inner}</div>;
  }

  return (
    <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] md:top-0 z-10 -mx-4 px-4 md:-mx-8 md:px-8 pt-5 pb-5 bg-[#050508]">
      {inner}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, rgba(139,92,246,0.25) 0%, #1e1e32 22%, transparent 65%)",
        }}
      />
    </div>
  );
}
