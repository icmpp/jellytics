"use client";

import { Fragment } from "react";
import { AppLayout, PageHeader, PageContent } from "@/components/layout";
import { MediaGridSkeleton } from "@/components/ui/media-grid-skeleton";
import { RefetchingIndicator } from "@/components/ui/refetching-indicator";
import { MEDIA_GRID_CLASS } from "@/lib/utils";
import type { BreadcrumbItem } from "@/components/navigation";

interface SimpleMediaGridPageProps<T> {
  breadcrumb: BreadcrumbItem[];
  title: string;
  description: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  isLoading: boolean;
  isError?: boolean;
  isFetching?: boolean;
  errorContent?: React.ReactNode;
  isEmpty: boolean;
  emptyContent: React.ReactNode;
  countLabel: string;
  items: T[];
  renderCard: (item: T, index?: number) => React.ReactNode;
  getItemKey: (item: T) => string;
  skeletonCount?: number;
  /** Override grid class (e.g. COLLECTIONS_GRID_CLASS). Default: MEDIA_GRID_CLASS */
  gridClass?: string;
  /** Custom skeleton (e.g. CollectionsGridSkeleton for text-card grids). Default: MediaGridSkeleton */
  skeletonContent?: React.ReactNode;
}

/**
 * Shared layout for archive, watchlist, and similar grid pages without filters or pagination.
 */
export function SimpleMediaGridPage<T>({
  breadcrumb,
  title,
  description,
  icon,
  actions,
  isLoading,
  isError = false,
  isFetching = false,
  errorContent,
  isEmpty,
  emptyContent,
  countLabel,
  items,
  renderCard,
  getItemKey,
  skeletonCount = 12,
  gridClass = MEDIA_GRID_CLASS,
  skeletonContent,
}: SimpleMediaGridPageProps<T>) {
  return (
    <AppLayout>
      <PageContent>
        <PageHeader
          breadcrumb={breadcrumb}
          title={title}
          description={description}
          icon={icon}
          actions={actions}
        />

        {isLoading &&
          (skeletonContent ?? <MediaGridSkeleton count={skeletonCount} />)}

        {!isLoading && isError && errorContent}

        {!isLoading && !isError && isEmpty && emptyContent}

        {!isLoading && !isError && !isEmpty && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 mb-4 border-b border-white/[0.06]">
              <p className="text-sm text-white/40">{countLabel}</p>
              <RefetchingIndicator isFetching={isFetching} isLoading={isLoading} />
            </div>
            <div className={gridClass}>
              {items.map((item, index) => (
                <Fragment key={getItemKey(item)}>{renderCard(item, index)}</Fragment>
              ))}
            </div>
          </>
        )}
      </PageContent>
    </AppLayout>
  );
}
