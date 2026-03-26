import { Skeleton } from "@/components/ui/loading-skeleton";
import { cn, COLLECTIONS_GRID_CLASS, MEDIA_CARD_BASE } from "@/lib/utils";

interface CollectionsGridSkeletonProps {
  count?: number;
}

/**
 * Skeleton for collections grid - text-heavy cards matching COLLECTIONS_GRID_CLASS layout.
 */
export function CollectionsGridSkeleton({ count = 6 }: CollectionsGridSkeletonProps) {
  return (
    <div className={COLLECTIONS_GRID_CLASS}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn(MEDIA_CARD_BASE, "p-4")}>
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-full mt-2" />
          <Skeleton className="h-4 w-2/3 mt-1" />
        </div>
      ))}
    </div>
  );
}
