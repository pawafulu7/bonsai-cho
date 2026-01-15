/**
 * Thumbnail Utility Functions
 *
 * Pure TypeScript functions for thumbnail generation.
 * Separated from WASM-dependent code for testability.
 */

/**
 * Error codes for thumbnail generation failures
 */
export type ThumbnailErrorCode =
  | "INVALID_IMAGE"
  | "PIXEL_COUNT_EXCEEDED"
  | "RESIZE_FAILED"
  | "ENCODE_FAILED"
  | "MEMORY_ERROR";

/**
 * Metadata for thumbnail generation errors
 */
export interface ThumbnailErrorMetadata {
  inputSize?: number;
  width?: number;
  height?: number;
  pixelCount?: number;
  originalError?: string;
}

/**
 * Structured error class for thumbnail generation failures
 */
export class ThumbnailGenerationError extends Error {
  constructor(
    message: string,
    public readonly code: ThumbnailErrorCode,
    public readonly metadata?: ThumbnailErrorMetadata
  ) {
    super(message);
    this.name = "ThumbnailGenerationError";
  }
}

/**
 * Calculate thumbnail dimensions maintaining aspect ratio
 *
 * @param originalWidth - Original image width
 * @param originalHeight - Original image height
 * @param targetSize - Target maximum dimension
 * @returns Calculated dimensions
 */
export function calculateThumbnailDimensions(
  originalWidth: number,
  originalHeight: number,
  targetSize: number
): { width: number; height: number } {
  // If image is already smaller than target, return original dimensions
  if (originalWidth <= targetSize && originalHeight <= targetSize) {
    return { width: originalWidth, height: originalHeight };
  }

  // Calculate scale factor based on the larger dimension
  const scale = Math.min(
    targetSize / originalWidth,
    targetSize / originalHeight
  );

  // Calculate new dimensions, ensuring at least 1px
  const width = Math.max(1, Math.round(originalWidth * scale));
  const height = Math.max(1, Math.round(originalHeight * scale));

  return { width, height };
}

/**
 * Log structured thumbnail generation error
 *
 * @param error - The error to log
 * @param context - Additional context (e.g., bonsaiId)
 */
export function logThumbnailError(
  error: ThumbnailGenerationError,
  context?: Record<string, unknown>
): void {
  console.error("[ThumbnailGeneration]", {
    code: error.code,
    message: error.message,
    metadata: error.metadata,
    ...context,
  });
}
