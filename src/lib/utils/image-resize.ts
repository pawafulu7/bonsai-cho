/**
 * Client-side Image Resize Utilities
 *
 * Provides image resizing and compression in the browser using Canvas API.
 * Used for reducing file size before upload to improve upload speed
 * and reduce server-side processing.
 */

/**
 * Options for image resize operation
 */
export interface ResizeOptions {
  /** Maximum width in pixels */
  maxWidth: number;
  /** Maximum height in pixels */
  maxHeight: number;
  /** Quality for JPEG output (0.0 - 1.0) */
  quality: number;
  /** Output format */
  format: "image/jpeg" | "image/webp";
}

/**
 * Result of image resize operation
 */
export interface ResizeResult {
  /** Resized image as Blob */
  blob: Blob;
  /** Final width after resize */
  width: number;
  /** Final height after resize */
  height: number;
  /** Original width */
  originalWidth: number;
  /** Original height */
  originalHeight: number;
}

/**
 * Default resize options
 * - Max dimension 2048px (balances quality and file size)
 * - JPEG quality 0.85 (good quality with reasonable compression)
 */
export const DEFAULT_RESIZE_OPTIONS: ResizeOptions = {
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 0.85,
  format: "image/jpeg",
};

/**
 * Load an image file into an HTMLImageElement
 *
 * @param file - File object to load
 * @returns Promise resolving to loaded image element
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

/**
 * Calculate new dimensions while maintaining aspect ratio
 *
 * @param originalWidth - Original image width
 * @param originalHeight - Original image height
 * @param maxWidth - Maximum allowed width
 * @param maxHeight - Maximum allowed height
 * @returns New dimensions that fit within constraints
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  // If image is smaller than max dimensions, keep original size
  if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
    return { width: originalWidth, height: originalHeight };
  }

  // Calculate aspect ratio
  const aspectRatio = originalWidth / originalHeight;

  let newWidth = originalWidth;
  let newHeight = originalHeight;

  // Scale down to fit within maxWidth
  if (newWidth > maxWidth) {
    newWidth = maxWidth;
    newHeight = Math.round(newWidth / aspectRatio);
  }

  // Scale down further if still exceeds maxHeight
  if (newHeight > maxHeight) {
    newHeight = maxHeight;
    newWidth = Math.round(newHeight * aspectRatio);
  }

  return { width: newWidth, height: newHeight };
}

/**
 * Convert canvas to Blob with specified format and quality
 *
 * @param canvas - Canvas element to convert
 * @param format - Output format (image/jpeg or image/webp)
 * @param quality - Output quality (0.0 - 1.0)
 * @returns Promise resolving to Blob
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to create blob from canvas"));
        }
      },
      format,
      quality
    );
  });
}

/**
 * Resize an image file
 *
 * Uses Canvas API to resize the image while maintaining aspect ratio.
 * Supports JPEG and WebP output formats with configurable quality.
 *
 * @param file - Image file to resize
 * @param options - Resize options (optional, uses defaults if not provided)
 * @returns Promise resolving to resize result with blob and dimensions
 *
 * @example
 * ```typescript
 * const file = inputElement.files[0];
 * const result = await resizeImage(file, {
 *   maxWidth: 2048,
 *   maxHeight: 2048,
 *   quality: 0.85,
 *   format: 'image/jpeg'
 * });
 * console.log(`Resized from ${result.originalWidth}x${result.originalHeight}`);
 * console.log(`to ${result.width}x${result.height}`);
 * ```
 */
export async function resizeImage(
  file: File,
  options: Partial<ResizeOptions> = {}
): Promise<ResizeResult> {
  const opts: ResizeOptions = { ...DEFAULT_RESIZE_OPTIONS, ...options };

  // Load image
  const img = await loadImage(file);

  // Calculate new dimensions
  const { width, height } = calculateDimensions(
    img.naturalWidth,
    img.naturalHeight,
    opts.maxWidth,
    opts.maxHeight
  );

  // Create canvas and draw resized image
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  // Use high quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Draw image to canvas
  ctx.drawImage(img, 0, 0, width, height);

  // Convert to blob
  const blob = await canvasToBlob(canvas, opts.format, opts.quality);

  return {
    blob,
    width,
    height,
    originalWidth: img.naturalWidth,
    originalHeight: img.naturalHeight,
  };
}

/**
 * Check if image needs resizing based on dimensions
 *
 * @param file - Image file to check
 * @param maxWidth - Maximum allowed width
 * @param maxHeight - Maximum allowed height
 * @returns Promise resolving to true if resize is needed
 */
export async function needsResize(
  file: File,
  maxWidth: number = DEFAULT_RESIZE_OPTIONS.maxWidth,
  maxHeight: number = DEFAULT_RESIZE_OPTIONS.maxHeight
): Promise<boolean> {
  const img = await loadImage(file);
  return img.naturalWidth > maxWidth || img.naturalHeight > maxHeight;
}

/**
 * Get image dimensions from file
 *
 * @param file - Image file
 * @returns Promise resolving to dimensions
 */
export async function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  const img = await loadImage(file);
  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
  };
}

/**
 * Format file size for display
 *
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
