import { Skeleton } from "@/components/ui/loading-skeleton";
import { MEDIA_GRID_CLASS } from "@/lib/utils";

interface MediaGridSkeletonProps {
  count?: number;
}

export function MediaGridSkeleton({ count = 12 }: MediaGridSkeletonProps) {
  return (
    <div className={MEDIA_GRID_CLASS}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 min-w-0">
          <Skeleton className="aspect-[2/3] w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
