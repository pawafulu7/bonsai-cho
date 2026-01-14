/**
 * Bonsai Gallery Components
 *
 * A collection of components for displaying and managing bonsai images.
 */

// Types re-export for convenience
export type {
  BonsaiGalleryProps,
  GalleryHeroProps,
  GalleryImage,
  GalleryLightboxNavigationProps,
  GalleryLightboxProps,
  GallerySkeletonProps,
  GalleryThumbnailItemProps,
  GalleryThumbnailListProps,
  GalleryUploaderProps,
} from "@/types/gallery";
// Main integration component
export { BonsaiGallery } from "./BonsaiGallery";

// Display components
export { GalleryHero } from "./GalleryHero";
export { GalleryLightbox } from "./GalleryLightbox";
export { GalleryLightboxNavigation } from "./GalleryLightboxNavigation";
export { GallerySkeleton } from "./GallerySkeleton";
export { GalleryThumbnailItem } from "./GalleryThumbnailItem";
export { GalleryThumbnailList } from "./GalleryThumbnailList";

// Sortable components (for owner editing)
export { SortableGalleryThumbnailItem } from "./SortableGalleryThumbnailItem";
export { SortableGalleryThumbnailList } from "./SortableGalleryThumbnailList";

// Hooks
export { useGalleryImages } from "./useGalleryImages";
