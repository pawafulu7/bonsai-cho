import { cn } from "@/lib/utils";
import type { GalleryThumbnailListProps } from "@/types/gallery";
import { GalleryThumbnailItem } from "./GalleryThumbnailItem";

/**
 * GalleryThumbnailList - Container for thumbnail images
 *
 * Displays thumbnails in:
 * - Desktop: Vertical stack (within 35% width)
 * - Mobile: Horizontal scroll with snap
 *
 * Supports optional drag-and-drop reordering via dnd-kit
 * (sortable mode is handled in BonsaiGallery integration).
 */
export function GalleryThumbnailList({
  images,
  selectedId,
  onSelect,
  className,
}: GalleryThumbnailListProps) {
  if (images.length === 0) {
    return null;
  }

  return (
    <>
      {/* Desktop: Vertical stack */}
      <nav
        className={cn(
          "hidden lg:flex lg:flex-col lg:gap-3",
          // Set min-height to prevent layout shift
          "lg:min-h-[280px]",
          className
        )}
        aria-label="Bonsai image thumbnails"
      >
        {images.map((image) => (
          <GalleryThumbnailItem
            key={image.id}
            image={image}
            isSelected={selectedId === image.id}
            onClick={() => onSelect?.(image)}
          />
        ))}
      </nav>

      {/* Mobile: Horizontal scroll */}
      <nav
        className={cn(
          "flex gap-2 lg:hidden",
          // Horizontal scroll with snap
          "overflow-x-auto",
          "scroll-snap-type-x-mandatory",
          // Hide scrollbar but keep functionality
          "scrollbar-none",
          // Safe area for swipe hint
          "pb-2 -mb-2",
          className
        )}
        aria-label="Bonsai image thumbnails"
      >
        {images.map((image) => (
          <div key={image.id} className="flex-shrink-0 w-20">
            <GalleryThumbnailItem
              image={image}
              isSelected={selectedId === image.id}
              onClick={() => onSelect?.(image)}
              className="w-20 h-20"
            />
          </div>
        ))}
      </nav>
    </>
  );
}
