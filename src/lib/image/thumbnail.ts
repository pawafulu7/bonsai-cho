/**
 * Thumbnail Generation Module
 *
 * Uses @cf-wasm/photon WebAssembly library for image processing.
 * Generates WebP thumbnails maintaining aspect ratio.
 *
 * Features:
 * - Aspect ratio preservation
 * - WebP output for optimal compression
 * - Pixel count validation (16M limit)
 * - Structured error logging
 * - Early return for small images
 */

import { PhotonImage, resize, SamplingFilter } from "@cf-wasm/photon/workerd";

export type {
  ThumbnailErrorCode,
  ThumbnailErrorMetadata,
} from "./thumbnail-utils";
// Re-export pure utilities for external use
export {
  calculateThumbnailDimensions,
  logThumbnailError,
  ThumbnailGenerationError,
} from "./thumbnail-utils";

// Import for internal use
import {
  calculateThumbnailDimensions,
  ThumbnailGenerationError,
} from "./thumbnail-utils";

// Constants
const MAX_PIXEL_COUNT = 16_000_000; // 16M pixels (e.g., 4000x4000)
// Note: Quality setting is reserved for future use when @cf-wasm/photon supports it
// const DEFAULT_WEBP_QUALITY = 85;

/**
 * Options for thumbnail generation
 */
export interface ThumbnailOptions {
  /** Target dimension (width or height, whichever is larger) */
  targetSize: number;
  /** WebP quality (0-100, default: 85) - reserved for future use */
  quality?: number;
}

/**
 * Result of thumbnail generation
 */
export interface ThumbnailResult {
  /** Generated thumbnail data */
  data: Uint8Array;
  /** Thumbnail width in pixels */
  width: number;
  /** Thumbnail height in pixels */
  height: number;
  /** Output format (always "webp") */
  format: "webp";
}

/**
 * Generate a thumbnail from image data
 *
 * @param imageData - Original image data as ArrayBuffer
 * @param options - Thumbnail generation options
 * @returns Thumbnail result with data and dimensions
 * @throws ThumbnailGenerationError if generation fails
 */
export async function generateThumbnail(
  imageData: ArrayBuffer,
  options: ThumbnailOptions
): Promise<ThumbnailResult> {
  const { targetSize } = options;
  // Note: quality option is reserved for future use when @cf-wasm/photon supports it
  let photonImage: PhotonImage | null = null;
  let resizedImage: PhotonImage | null = null;

  try {
    // Load image from bytes
    try {
      photonImage = PhotonImage.new_from_byteslice(new Uint8Array(imageData));
    } catch (error) {
      throw new ThumbnailGenerationError(
        "Failed to decode image data",
        "INVALID_IMAGE",
        {
          inputSize: imageData.byteLength,
          originalError: error instanceof Error ? error.message : String(error),
        }
      );
    }

    const originalWidth = photonImage.get_width();
    const originalHeight = photonImage.get_height();
    const pixelCount = originalWidth * originalHeight;

    // Validate pixel count
    if (pixelCount > MAX_PIXEL_COUNT) {
      throw new ThumbnailGenerationError(
        `Image pixel count (${pixelCount}) exceeds maximum (${MAX_PIXEL_COUNT})`,
        "PIXEL_COUNT_EXCEEDED",
        {
          width: originalWidth,
          height: originalHeight,
          pixelCount,
        }
      );
    }

    // Calculate target dimensions
    const { width: targetWidth, height: targetHeight } =
      calculateThumbnailDimensions(originalWidth, originalHeight, targetSize);

    // Early return if image is already at or below target size
    if (targetWidth === originalWidth && targetHeight === originalHeight) {
      // Still convert to WebP for consistency
      const webpData = photonImage.get_bytes_webp();
      return {
        data: webpData,
        width: originalWidth,
        height: originalHeight,
        format: "webp",
      };
    }

    // Resize image using Lanczos3 for high quality
    try {
      resizedImage = resize(
        photonImage,
        targetWidth,
        targetHeight,
        SamplingFilter.Lanczos3
      );
    } catch (error) {
      throw new ThumbnailGenerationError(
        "Failed to resize image",
        "RESIZE_FAILED",
        {
          width: originalWidth,
          height: originalHeight,
          originalError: error instanceof Error ? error.message : String(error),
        }
      );
    }

    // Encode to WebP
    let webpData: Uint8Array;
    try {
      // Note: @cf-wasm/photon's get_bytes_webp() doesn't support quality parameter
      // It uses a default quality setting internally
      webpData = resizedImage.get_bytes_webp();
    } catch (error) {
      throw new ThumbnailGenerationError(
        "Failed to encode image to WebP",
        "ENCODE_FAILED",
        {
          width: targetWidth,
          height: targetHeight,
          originalError: error instanceof Error ? error.message : String(error),
        }
      );
    }

    return {
      data: webpData,
      width: targetWidth,
      height: targetHeight,
      format: "webp",
    };
  } catch (error) {
    // Re-throw ThumbnailGenerationError as-is
    if (error instanceof ThumbnailGenerationError) {
      throw error;
    }

    // Wrap unexpected errors
    throw new ThumbnailGenerationError(
      `Unexpected error during thumbnail generation: ${error instanceof Error ? error.message : String(error)}`,
      "MEMORY_ERROR",
      {
        inputSize: imageData.byteLength,
        originalError: error instanceof Error ? error.message : String(error),
      }
    );
  } finally {
    // Always free memory for PhotonImage instances
    if (resizedImage) {
      try {
        resizedImage.free();
      } catch {
        // Ignore cleanup errors
      }
    }
    if (photonImage) {
      try {
        photonImage.free();
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
