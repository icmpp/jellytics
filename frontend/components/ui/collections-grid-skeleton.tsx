import { Skeleton } from "@/components/ui/loading-skeleton";
import { COLLECTIONS_GRID_CLASS } from "@/lib/utils";

interface CollectionsGridSkeletonProps {
  count?: number;
}

/**
 * Skeleton for collections grid — terminal text cards matching COLLECTIONS_GRID_CLASS layout.
 */
export function CollectionsGridSkeleton({ count = 6 }: CollectionsGridSkeletonProps) {
  return (
    <div className={COLLECTIONS_GRID_CLASS}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3.5 rounded-sm border border-[#16162a] bg-[#0a0a14] p-4"
        >
          <Skeleton className="h-10 w-10 shrink-0 rounded-sm" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-3/4 rounded-sm" />
            <Skeleton className="mt-2 h-3 w-full rounded-sm" />
            <Skeleton className="mt-1 h-3 w-2/3 rounded-sm" />
            <Skeleton className="mt-2.5 h-4 w-1/3 rounded-sm" />
          </div>
        </div>
      ))}
    </div>
  );
}
