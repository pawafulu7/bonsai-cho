import { AnimatePresence, domAnimation, LazyMotion, m } from "framer-motion";
import { X } from "lucide-react";
import { useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { GalleryLightboxProps } from "@/types/gallery";
import { GalleryLightboxNavigation } from "./GalleryLightboxNavigation";

/**
 * GalleryLightbox - Full-screen image viewer
 *
 * Features:
 * - Animated entrance/exit (scale 0.97->1, opacity)
 * - Keyboard navigation (Arrow keys, Escape)
 * - Touch-friendly navigation buttons
 * - Accessibility: focus trap, ARIA labels
 */
export function GalleryLightbox({
  images,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
}: GalleryLightboxProps) {
  const currentImage = images[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case "ArrowLeft":
          if (hasPrev) {
            event.preventDefault();
            onNavigate("prev");
          }
          break;
        case "ArrowRight":
          if (hasNext) {
            event.preventDefault();
            onNavigate("next");
          }
          break;
        case "Home":
          event.preventDefault();
          onNavigate("prev");
          break;
        case "End":
          event.preventDefault();
          onNavigate("next");
          break;
      }
    },
    [isOpen, hasPrev, hasNext, onNavigate]
  );

  // Register keyboard event listener
  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isOpen, handleKeyDown]);

  if (!currentImage) {
    return null;
  }

  return (
    <LazyMotion features={domAnimation}>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className={cn(
            "max-w-none w-screen h-screen",
            "p-0 border-0 rounded-none",
            "bg-black/90",
            // Override default dialog positioning
            "fixed inset-0 translate-x-0 translate-y-0",
            "flex items-center justify-center"
          )}
          // Remove default close button (we have custom one)
          // @ts-expect-error - Remove close button from dialog
          hideCloseButton
        >
          {/* Hidden title for accessibility */}
          <DialogTitle className="sr-only">
            Image viewer - {currentImage.caption || `Image ${currentIndex + 1}`}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {currentIndex + 1} of {images.length} images. Use arrow keys to
            navigate. Press Escape to close.
          </DialogDescription>

          {/* Custom close button */}
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "absolute top-4 right-4 z-50",
              "w-10 h-10 rounded-full",
              "bg-black/40 backdrop-blur-sm",
              "flex items-center justify-center",
              "text-white",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
              "tap-target",
              "transition-all duration-150",
              "hover:bg-black/60",
              // Safe area for notched devices
              "top-[max(1rem,env(safe-area-inset-top))]",
              "right-[max(1rem,env(safe-area-inset-right))]"
            )}
            aria-label="Close image viewer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Animated image container */}
          <AnimatePresence mode="wait">
            <m.div
              key={currentImage.id}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{
                duration: 0.2,
                ease: [0.16, 1, 0.3, 1], // ease-out-expo
              }}
              className="relative max-w-full max-h-full p-4"
            >
              <img
                src={currentImage.imageUrl}
                alt={currentImage.caption || `Bonsai image ${currentIndex + 1}`}
                className={cn(
                  "max-w-full max-h-[calc(100vh-8rem)]",
                  "object-contain",
                  "rounded-lg"
                )}
                loading="eager"
                decoding="async"
              />

              {/* Caption (if exists) */}
              {currentImage.caption && (
                <m.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.2 }}
                  className={cn(
                    "absolute bottom-0 left-4 right-4",
                    "px-4 py-2 rounded-b-lg",
                    "bg-black/60 backdrop-blur-sm",
                    "text-white text-sm font-serif text-center"
                  )}
                >
                  {currentImage.caption}
                </m.div>
              )}
            </m.div>
          </AnimatePresence>

          {/* Navigation controls */}
          {images.length > 1 && (
            <GalleryLightboxNavigation
              currentIndex={currentIndex}
              totalImages={images.length}
              onPrev={() => onNavigate("prev")}
              onNext={() => onNavigate("next")}
              hasPrev={hasPrev}
              hasNext={hasNext}
            />
          )}
        </DialogContent>
      </Dialog>
    </LazyMotion>
  );
}
