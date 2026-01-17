import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface BonsaiListSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * BonsaiListSkeleton - Loading skeleton for bonsai card grid
 *
 * Features:
 * - Matches BonsaiCard layout exactly
 * - Prevents CLS with fixed aspect-ratio
 * - Accessible with aria-label
 */
export function BonsaiListSkeleton({
  count = 8,
  className,
}: BonsaiListSkeletonProps) {
  // Generate stable IDs for skeleton items
  const skeletonIds = Array.from(
    { length: count },
    (_, i) => `skeleton-item-${i}`
  );

  return (
    // biome-ignore lint/a11y/useSemanticElements: <output> is for form calculations; role="status" is correct for loading state
    <div
      role="status"
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6",
        className
      )}
      aria-label="読み込み中..."
      aria-busy="true"
    >
      {skeletonIds.map((id) => (
        <div
          key={id}
          className="bg-card rounded-tl-xl rounded-br-xl overflow-hidden border-l-4 border-primary/30 shadow-card"
        >
          {/* Image Skeleton */}
          <Skeleton className="aspect-[4/3] w-full rounded-none" />

          {/* Content Skeleton */}
          <div className="p-4 space-y-3">
            {/* Title */}
            <Skeleton className="h-6 w-3/4" />

            {/* Species/Style */}
            <Skeleton className="h-4 w-1/2" />

            {/* Description */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
