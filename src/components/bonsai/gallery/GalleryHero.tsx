import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GalleryHeroProps } from "@/types/gallery";

/**
 * GalleryHero - Main image display component
 *
 * Displays the primary/selected image in a large format.
 * Clicking opens the lightbox for full-screen viewing.
 */
export function GalleryHero({ image, onClick, className }: GalleryHeroProps) {
  if (!image) {
    return (
      <div
        className={cn(
          "relative w-full rounded-lg overflow-hidden",
          "aspect-[4/3]",
          "bg-muted",
          "flex items-center justify-center",
          className
        )}
      >
        <div className="text-center text-muted-foreground">
          <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No images</p>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full rounded-lg overflow-hidden",
        "aspect-[4/3]",
        "bg-muted",
        "cursor-pointer",
        "group",
        // Focus styles for accessibility
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        // Transition for hover effect
        "transition-shadow duration-200",
        "hover:shadow-lg",
        className
      )}
      aria-label={
        image.caption
          ? `View ${image.caption} in full screen`
          : "View image in full screen"
      }
    >
      <img
        src={image.imageUrl}
        alt={image.caption || "Bonsai image"}
        className={cn(
          "w-full h-full object-cover",
          // Subtle zoom on hover (controlled animation)
          "transition-transform duration-300 ease-out",
          "group-hover:scale-[1.02]"
        )}
        loading="eager"
        decoding="async"
      />

      {/* Overlay gradient for depth */}
      <div
        className={cn(
          "absolute inset-0",
          "bg-gradient-to-t from-black/10 to-transparent",
          "opacity-0 group-hover:opacity-100",
          "transition-opacity duration-200"
        )}
      />

      {/* Caption overlay (if exists) */}
      {image.caption && (
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0",
            "px-4 py-3",
            "bg-gradient-to-t from-black/60 to-transparent",
            "opacity-0 group-hover:opacity-100",
            "transition-opacity duration-200"
          )}
        >
          <p className="text-white text-sm font-serif line-clamp-2">
            {image.caption}
          </p>
        </div>
      )}

      {/* Click hint icon */}
      <div
        className={cn(
          "absolute top-4 right-4",
          "w-8 h-8 rounded-full",
          "bg-black/40 backdrop-blur-sm",
          "flex items-center justify-center",
          "opacity-0 group-hover:opacity-100",
          "transition-opacity duration-200"
        )}
      >
        <svg
          className="w-4 h-4 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <title>Zoom in</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
          />
        </svg>
      </div>
    </button>
  );
}
