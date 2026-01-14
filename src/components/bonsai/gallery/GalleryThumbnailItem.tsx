import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GalleryThumbnailItemProps } from "@/types/gallery";

/**
 * GalleryThumbnailItem - Individual thumbnail component
 *
 * Displays a single thumbnail with selection state and primary indicator.
 * Supports both static and sortable (dnd-kit) modes.
 */
export function GalleryThumbnailItem({
  image,
  isSelected = false,
  onClick,
  className,
}: GalleryThumbnailItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex-shrink-0",
        "w-full aspect-square",
        "rounded-md overflow-hidden",
        "bg-muted",
        "cursor-pointer",
        "group",
        // Focus styles
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        // Selection ring (Primary color)
        isSelected && "ring-2 ring-primary ring-offset-2",
        // Hover opacity animation (wa-modern subtle)
        "transition-all duration-150",
        !isSelected && "opacity-70 hover:opacity-100",
        className
      )}
      aria-label={
        image.caption
          ? `Select ${image.caption}`
          : `Select image ${image.sortOrder + 1}`
      }
      aria-pressed={isSelected}
    >
      <img
        src={image.thumbnailUrl || image.imageUrl}
        alt={image.caption || `Bonsai image ${image.sortOrder + 1}`}
        className="w-full h-full object-cover"
        loading="lazy"
        decoding="async"
      />

      {/* Primary indicator */}
      {image.isPrimary && (
        <div
          className={cn(
            "absolute top-1 left-1",
            "w-5 h-5 rounded-full",
            "bg-accent",
            "flex items-center justify-center",
            "shadow-sm"
          )}
          title="Primary image"
        >
          <Star className="w-3 h-3 text-white fill-current" />
        </div>
      )}

      {/* Hover overlay */}
      <div
        className={cn(
          "absolute inset-0",
          "bg-black/0 group-hover:bg-black/10",
          "transition-colors duration-150"
        )}
      />
    </button>
  );
}
