import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { GallerySkeletonProps } from "@/types/gallery";

/**
 * GallerySkeleton - Loading state for the gallery
 *
 * Displays skeleton placeholders for the Hero image and thumbnails
 * following the 65:35 non-asymmetric layout pattern.
 */
export function GallerySkeleton({
  thumbnailCount = 4,
  className,
}: GallerySkeletonProps) {
  return (
    <div
      className={cn(
        "grid gap-4",
        // Desktop: 65:35 non-asymmetric layout
        "lg:grid-cols-[65fr_35fr]",
        // Mobile/Tablet: stacked layout
        "grid-cols-1",
        className
      )}
    >
      {/* Hero Skeleton */}
      <div className="relative">
        <Skeleton
          className={cn(
            "w-full rounded-lg",
            // Aspect ratio 4:3 for hero image
            "aspect-[4/3]",
            "bg-muted"
          )}
        />
      </div>

      {/* Thumbnails Skeleton */}
      <div
        className={cn(
          // Desktop: vertical stack
          "hidden lg:flex lg:flex-col lg:gap-3",
          // Set min-height to prevent layout shift
          "lg:min-h-[280px]"
        )}
      >
        {Array.from({ length: thumbnailCount }).map((_, index) => (
          <Skeleton
            // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton elements with no state or reordering
            key={`skeleton-thumb-${index}`}
            className={cn("w-full rounded-md", "aspect-square", "bg-muted")}
          />
        ))}
      </div>

      {/* Mobile: Horizontal scroll thumbnails */}
      <div
        className={cn(
          "flex gap-2 overflow-x-auto",
          "lg:hidden",
          // Horizontal scroll with snap
          "scroll-snap-x-mandatory",
          "pb-2"
        )}
      >
        {Array.from({ length: thumbnailCount }).map((_, index) => (
          <Skeleton
            // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton elements with no state or reordering
            key={`skeleton-thumb-mobile-${index}`}
            className={cn(
              "flex-shrink-0",
              "w-20 h-20",
              "rounded-md",
              "bg-muted"
            )}
          />
        ))}
      </div>
    </div>
  );
}
