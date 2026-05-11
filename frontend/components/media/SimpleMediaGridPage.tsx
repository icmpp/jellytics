"use client";

import { Fragment, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AppLayout, PageHeader, PageContent } from "@/components/layout";
import { MediaGridSkeleton } from "@/components/ui/media-grid-skeleton";
import { ArrowUp } from "lucide-react";
import { MEDIA_GRID_CLASS, cn } from "@/lib/utils";
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
 * Shared layout for archive, watchlist, collections, and similar grid pages without filters.
 */
export function SimpleMediaGridPage<T>({
  breadcrumb,
  title,
  description,
  icon,
  actions,
  isLoading,
  isError = false,
  errorContent,
  isEmpty,
  emptyContent,
  items,
  renderCard,
  getItemKey,
  skeletonCount = 12,
  gridClass = MEDIA_GRID_CLASS,
  skeletonContent,
}: SimpleMediaGridPageProps<T>) {
  return (
    <AppLayout>
      <PageHeader
        breadcrumb={breadcrumb}
        title={title}
        description={description}
        icon={icon}
        actions={actions}
      />
      <PageContent>
        {isLoading && (skeletonContent ?? <MediaGridSkeleton count={skeletonCount} />)}

        {!isLoading && isError && errorContent}

        {!isLoading && !isError && isEmpty && emptyContent}

        {!isLoading && !isError && !isEmpty && (
          <div className={gridClass}>
            {items.map((item, index) => (
              <motion.div
                key={getItemKey(item)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.2,
                  delay: Math.min(index * 0.04, 0.5),
                  ease: "easeOut",
                }}
              >
                {renderCard(item, index)}
              </motion.div>
            ))}
          </div>
        )}
      </PageContent>

      <JumpToTopButton />
    </AppLayout>
  );
}

function JumpToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 800);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Jump to top"
      className={cn(
        "fixed bottom-6 right-6 z-30 h-11 w-11 rounded-full",
        "bg-purple-500/90 text-white shadow-xl shadow-black/40",
        "hover:bg-purple-500 transition-colors",
        "flex items-center justify-center",
      )}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
