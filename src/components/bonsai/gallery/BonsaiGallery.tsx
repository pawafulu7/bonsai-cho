import { useState } from "react";
import { cn } from "@/lib/utils";
import type { BonsaiGalleryProps, GalleryImage } from "@/types/gallery";
import { GalleryHero } from "./GalleryHero";
import { GalleryLightbox } from "./GalleryLightbox";
import { GallerySkeleton } from "./GallerySkeleton";
import { GalleryThumbnailList } from "./GalleryThumbnailList";
import { SortableGalleryThumbnailList } from "./SortableGalleryThumbnailList";
import { useGalleryImages } from "./useGalleryImages";

/**
 * BonsaiGallery - Main gallery integration component
 *
 * Displays bonsai images in a 65:35 non-asymmetric layout with:
 * - Hero image (large, clickable to open lightbox)
 * - Thumbnail list (vertical on desktop, horizontal on mobile)
 * - Optional sortable mode for image reordering
 * - Full-screen lightbox for detailed viewing
 *
 * Uses client:load directive in Astro for full interactivity.
 */
export function BonsaiGallery({
  bonsaiId,
  images: initialImages = [],
  isOwner = false,
  csrfToken,
  className,
}: BonsaiGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const {
    images,
    isLoading,
    error,
    selectedImage,
    setSelectedImage,
    reorderImages,
    refetch,
  } = useGalleryImages({
    bonsaiId,
    initialImages,
    csrfToken,
  });

  // Handle thumbnail selection
  const handleSelectImage = (image: GalleryImage) => {
    setSelectedImage(image);
  };

  // Handle hero click to open lightbox
  const handleHeroClick = () => {
    if (selectedImage) {
      const index = images.findIndex((img) => img.id === selectedImage.id);
      setLightboxIndex(index >= 0 ? index : 0);
      setLightboxOpen(true);
    }
  };

  // Handle lightbox navigation
  const handleLightboxPrev = () => {
    setLightboxIndex((prev) => Math.max(0, prev - 1));
  };

  const handleLightboxNext = () => {
    setLightboxIndex((prev) => Math.min(images.length - 1, prev + 1));
  };

  const handleLightboxGoToFirst = () => {
    setLightboxIndex(0);
  };

  const handleLightboxGoToLast = () => {
    setLightboxIndex(images.length - 1);
  };

  // Handle lightbox close - sync selected image with current lightbox view
  const handleLightboxClose = () => {
    const currentImage = images[lightboxIndex];
    if (currentImage) {
      setSelectedImage(currentImage);
    }
    setLightboxOpen(false);
  };

  // Handle reorder (owner only)
  const handleReorder = async (newOrder: GalleryImage[]) => {
    if (!isOwner) return;
    try {
      await reorderImages(newOrder);
    } catch {
      // Error is already handled in the hook
    }
  };

  // Show skeleton while loading
  if (isLoading && images.length === 0) {
    return <GallerySkeleton className={className} />;
  }

  // Show error state
  if (error && images.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center",
          className
        )}
      >
        <p className="text-destructive text-sm">{error}</p>
        <button
          type="button"
          className="mt-2 text-sm text-muted-foreground hover:text-foreground underline"
          onClick={() => refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  // Choose thumbnail list component based on owner status
  const ThumbnailList = isOwner
    ? SortableGalleryThumbnailList
    : GalleryThumbnailList;

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
      {/* Hero Image */}
      <GalleryHero image={selectedImage} onClick={handleHeroClick} />

      {/* Thumbnail List */}
      <ThumbnailList
        images={images}
        selectedId={selectedImage?.id}
        onSelect={handleSelectImage}
        {...(isOwner && { onReorder: handleReorder })}
      />

      {/* Lightbox */}
      <GalleryLightbox
        images={images}
        isOpen={lightboxOpen}
        currentIndex={lightboxIndex}
        onClose={handleLightboxClose}
        onPrev={handleLightboxPrev}
        onNext={handleLightboxNext}
        onGoToFirst={handleLightboxGoToFirst}
        onGoToLast={handleLightboxGoToLast}
      />
    </div>
  );
}
