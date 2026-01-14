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
  /** Array of images to display */
  images: GalleryImage[];
  /** Bonsai ID for API calls */
  bonsaiId: string;
  /** Enable editing mode (drag-and-drop, delete) */
  editable?: boolean;
  /** Callback when image order changes */
  onOrderChange?: (imageIds: string[]) => void;
  /** Callback when an image is deleted */
  onImageDelete?: (imageId: string) => void;
  /** Callback when primary image is set */
  onSetPrimary?: (imageId: string) => void;
  /** Callback when a new image is uploaded */
  onImageUpload?: (image: GalleryImage) => void;
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
  /** Enable drag-and-drop reordering */
  sortable?: boolean;
  /** Callback when order changes via drag-and-drop */
  onReorder?: (activeId: string, overId: string) => void;
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
  /** Enable sortable mode (for dnd-kit) */
  sortable?: boolean;
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
  /** Navigate to previous/next image */
  onNavigate: (direction: "prev" | "next") => void;
  /** Navigate to specific index */
  onIndexChange?: (index: number) => void;
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
  /** Whether previous button is disabled */
  hasPrev: boolean;
  /** Whether next button is disabled */
  hasNext: boolean;
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
