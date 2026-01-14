import { useCallback, useState } from "react";
import type { GalleryImage } from "@/types/gallery";

interface UseGalleryImagesOptions {
  bonsaiId: string;
  initialImages?: GalleryImage[];
  csrfToken?: string;
}

interface UseGalleryImagesReturn {
  images: GalleryImage[];
  isLoading: boolean;
  error: string | null;
  selectedImage: GalleryImage | null;
  setSelectedImage: (image: GalleryImage | null) => void;
  reorderImages: (newOrder: GalleryImage[]) => Promise<void>;
  updateImage: (
    imageId: string,
    updates: { caption?: string; isPrimary?: boolean }
  ) => Promise<void>;
  deleteImage: (imageId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * useGalleryImages - Custom hook for gallery image management
 *
 * Provides state management and API calls for gallery operations.
 * Handles optimistic updates with rollback on error.
 */
export function useGalleryImages({
  bonsaiId,
  initialImages = [],
  csrfToken,
}: UseGalleryImagesOptions): UseGalleryImagesReturn {
  const [images, setImages] = useState<GalleryImage[]>(initialImages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(
    initialImages.find((img) => img.isPrimary) || initialImages[0] || null
  );

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }
    return headers;
  }, [csrfToken]);

  // Fetch images from API
  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/bonsai/${bonsaiId}/images`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch images");
      }

      const data = await response.json();
      const fetchedImages = data.images as GalleryImage[];
      setImages(fetchedImages);

      // Update selected image if current selection is no longer valid
      if (
        selectedImage &&
        !fetchedImages.find((img) => img.id === selectedImage.id)
      ) {
        setSelectedImage(
          fetchedImages.find((img) => img.isPrimary) || fetchedImages[0] || null
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [bonsaiId, selectedImage]);

  // Reorder images (optimistic update)
  const reorderImages = useCallback(
    async (newOrder: GalleryImage[]) => {
      const previousImages = images;
      const imageIds = newOrder.map((img) => img.id);

      // Optimistic update
      setImages(newOrder);
      setError(null);

      try {
        const response = await fetch(`/api/bonsai/${bonsaiId}/images/reorder`, {
          method: "PATCH",
          headers: getHeaders(),
          credentials: "include",
          body: JSON.stringify({ imageIds }),
        });

        if (!response.ok) {
          throw new Error("Failed to reorder images");
        }
      } catch (err) {
        // Rollback on error
        setImages(previousImages);
        setError(err instanceof Error ? err.message : "Failed to reorder");
        throw err;
      }
    },
    [bonsaiId, images, getHeaders]
  );

  // Update image metadata (optimistic update)
  const updateImage = useCallback(
    async (
      imageId: string,
      updates: { caption?: string; isPrimary?: boolean }
    ) => {
      const previousImages = images;

      // Optimistic update
      setImages((prev) =>
        prev.map((img) => {
          if (img.id === imageId) {
            return { ...img, ...updates };
          }
          // Clear isPrimary from other images if setting new primary
          if (updates.isPrimary && img.isPrimary) {
            return { ...img, isPrimary: false };
          }
          return img;
        })
      );
      setError(null);

      try {
        const response = await fetch(
          `/api/bonsai/${bonsaiId}/images/${imageId}`,
          {
            method: "PATCH",
            headers: getHeaders(),
            credentials: "include",
            body: JSON.stringify(updates),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to update image");
        }

        const data = await response.json();
        // Update with server response to ensure consistency
        setImages((prev) =>
          prev.map((img) => (img.id === imageId ? data.image : img))
        );
      } catch (err) {
        // Rollback on error
        setImages(previousImages);
        setError(err instanceof Error ? err.message : "Failed to update");
        throw err;
      }
    },
    [bonsaiId, images, getHeaders]
  );

  // Delete image (optimistic update)
  const deleteImage = useCallback(
    async (imageId: string) => {
      const previousImages = images;
      const deletedImage = images.find((img) => img.id === imageId);

      // Optimistic update
      const newImages = images.filter((img) => img.id !== imageId);

      // Handle primary promotion locally
      if (deletedImage?.isPrimary && newImages.length > 0) {
        newImages[0] = { ...newImages[0], isPrimary: true };
      }

      setImages(newImages);

      // Update selected image if deleted
      if (selectedImage?.id === imageId) {
        setSelectedImage(
          newImages.find((img) => img.isPrimary) || newImages[0] || null
        );
      }

      setError(null);

      try {
        const response = await fetch(
          `/api/bonsai/${bonsaiId}/images/${imageId}`,
          {
            method: "DELETE",
            headers: getHeaders(),
            credentials: "include",
          }
        );

        if (!response.ok) {
          throw new Error("Failed to delete image");
        }
      } catch (err) {
        // Rollback on error
        setImages(previousImages);
        if (deletedImage) {
          setSelectedImage(deletedImage);
        }
        setError(err instanceof Error ? err.message : "Failed to delete");
        throw err;
      }
    },
    [bonsaiId, images, selectedImage, getHeaders]
  );

  return {
    images,
    isLoading,
    error,
    selectedImage,
    setSelectedImage,
    reorderImages,
    updateImage,
    deleteImage,
    refetch,
  };
}
