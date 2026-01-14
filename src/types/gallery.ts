/**
 * Gallery Types
 *
 * Type definitions for the bonsai image gallery components.
 */

/**
 * Represents a single image in the gallery
 */
export interface GalleryImage {
  id: string;
  bonsaiId: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  takenAt: string | null;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: string;
}

/**
 * Props for the main BonsaiGallery component
 */
export interface BonsaiGalleryProps {
  /** Bonsai ID for API calls */
  bonsaiId: string;
  /** Initial array of images to display */
  images?: GalleryImage[];
  /** Whether the current user is the owner (enables editing) */
  isOwner?: boolean;
  /** CSRF token for API mutations */
  csrfToken?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for the GalleryHero component
 */
export interface GalleryHeroProps {
  /** The image to display as hero */
  image: GalleryImage | null;
  /** Click handler to open lightbox */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for the GalleryThumbnailList component
 */
export interface GalleryThumbnailListProps {
  /** Array of images to display as thumbnails */
  images: GalleryImage[];
  /** Currently selected image ID */
  selectedId?: string;
  /** Click handler for thumbnail selection */
  onSelect?: (image: GalleryImage) => void;
  /** Callback when order changes via drag-and-drop (for sortable list) */
  onReorder?: (images: GalleryImage[]) => void;
  /** Disable drag interactions */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for the GalleryThumbnailItem component
 */
export interface GalleryThumbnailItemProps {
  /** The image to display */
  image: GalleryImage;
  /** Whether this thumbnail is selected */
  isSelected?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for the GalleryLightbox component
 */
export interface GalleryLightboxProps {
  /** Array of images for navigation */
  images: GalleryImage[];
  /** Index of the currently displayed image */
  currentIndex: number;
  /** Whether the lightbox is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Handler for previous button */
  onPrev: () => void;
  /** Handler for next button */
  onNext: () => void;
  /** Handler for Home key - jump to first image */
  onGoToFirst?: () => void;
  /** Handler for End key - jump to last image */
  onGoToLast?: () => void;
}

/**
 * Props for the GalleryLightboxNavigation component
 */
export interface GalleryLightboxNavigationProps {
  /** Current image index (0-based) */
  currentIndex: number;
  /** Total number of images */
  totalImages: number;
  /** Handler for previous button */
  onPrev: () => void;
  /** Handler for next button */
  onNext: () => void;
  /** Whether previous navigation is available */
  canGoPrev: boolean;
  /** Whether next navigation is available */
  canGoNext: boolean;
}

/**
 * Props for the GalleryUploader component
 */
export interface GalleryUploaderProps {
  /** Bonsai ID for upload */
  bonsaiId: string;
  /** Callback when upload is successful */
  onUpload: (image: GalleryImage) => void;
  /** Callback when upload fails */
  onError?: (error: string) => void;
  /** Whether upload is in progress */
  isUploading?: boolean;
  /** Current number of images (for limit check) */
  currentImageCount?: number;
  /** Maximum allowed images */
  maxImages?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for the GallerySkeleton component
 */
export interface GallerySkeletonProps {
  /** Number of thumbnail skeletons to show */
  thumbnailCount?: number;
  /** Additional CSS classes */
  className?: string;
}
