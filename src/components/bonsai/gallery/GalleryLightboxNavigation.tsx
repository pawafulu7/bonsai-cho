import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GalleryLightboxNavigationProps } from "@/types/gallery";

/**
 * GalleryLightboxNavigation - Navigation controls for lightbox
 *
 * Provides:
 * - Previous/Next buttons with accessibility
 * - Image counter display
 * - Touch-friendly tap targets (44px minimum)
 */
export function GalleryLightboxNavigation({
  currentIndex,
  totalImages,
  onPrev,
  onNext,
  canGoPrev,
  canGoNext,
}: GalleryLightboxNavigationProps) {
  return (
    <>
      {/* Previous Button */}
      <button
        type="button"
        onClick={onPrev}
        disabled={!canGoPrev}
        className={cn(
          "absolute top-1/2 -translate-y-1/2",
          "w-12 h-12 rounded-full",
          "bg-black/40 backdrop-blur-sm",
          "flex items-center justify-center",
          "text-white",
          // Focus styles
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
          // Touch target
          "tap-target",
          // Transition
          "transition-all duration-150",
          // Hover
          "hover:bg-black/60",
          // Disabled state
          "disabled:opacity-30 disabled:cursor-not-allowed",
          // Safe area for notched devices
          "left-[max(1rem,env(safe-area-inset-left))]"
        )}
        aria-label="Previous image"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      {/* Next Button */}
      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        className={cn(
          "absolute top-1/2 -translate-y-1/2",
          "w-12 h-12 rounded-full",
          "bg-black/40 backdrop-blur-sm",
          "flex items-center justify-center",
          "text-white",
          // Focus styles
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
          // Touch target
          "tap-target",
          // Transition
          "transition-all duration-150",
          // Hover
          "hover:bg-black/60",
          // Disabled state
          "disabled:opacity-30 disabled:cursor-not-allowed",
          // Safe area for notched devices
          "right-[max(1rem,env(safe-area-inset-right))]"
        )}
        aria-label="Next image"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Counter */}
      <output
        className={cn(
          "absolute left-1/2 -translate-x-1/2",
          "px-3 py-1.5 rounded-full",
          "bg-black/40 backdrop-blur-sm",
          "text-white text-sm font-sans",
          // Safe area for notched devices
          "bottom-[max(1rem,env(safe-area-inset-bottom))]"
        )}
        aria-live="polite"
      >
        <span className="sr-only">
          Image {currentIndex + 1} of {totalImages}
        </span>
        <span className="tabular-nums" aria-hidden="true">
          {currentIndex + 1} / {totalImages}
        </span>
      </output>
    </>
  );
}
