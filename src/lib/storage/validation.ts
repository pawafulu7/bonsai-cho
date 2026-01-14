/**
 * Image File Validation Utilities
 *
 * Provides comprehensive validation for uploaded image files:
 * - MIME type validation
 * - File extension validation
 * - Magic bytes (file signature) validation
 * - File size validation
 * - Image dimension validation (decompression bomb prevention)
 */

import { IMAGE_LIMITS } from "@/lib/env";

/**
 * Magic bytes signatures for supported image formats
 */
const MAGIC_BYTES = {
  jpeg: [
    [0xff, 0xd8, 0xff, 0xe0], // JFIF
    [0xff, 0xd8, 0xff, 0xe1], // EXIF
    [0xff, 0xd8, 0xff, 0xe2], // ICC
    [0xff, 0xd8, 0xff, 0xe3], // Samsung
    [0xff, 0xd8, 0xff, 0xe8], // SPIFF
    [0xff, 0xd8, 0xff, 0xdb], // Raw JPEG
    [0xff, 0xd8, 0xff, 0xee], // Adobe
  ],
  png: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  webp: [
    // RIFF....WEBP (bytes 0-3 and 8-11)
    // We check first 4 bytes (RIFF) and bytes 8-11 (WEBP)
  ],
} as const;

/**
 * WebP signature check (special case due to file structure)
 * Format: RIFF xxxx WEBP
 * Bytes 0-3: "RIFF" (52 49 46 46)
 * Bytes 8-11: "WEBP" (57 45 42 50)
 */
function isWebP(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;

  // Check "RIFF" at offset 0
  const riff =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46;
  // Check "WEBP" at offset 8
  const webp =
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;

  return riff && webp;
}

/**
 * Check if bytes match any of the given signatures
 */
function matchesMagicBytes(
  bytes: Uint8Array,
  signatures: readonly (readonly number[])[]
): boolean {
  return signatures.some((sig) => {
    if (bytes.length < sig.length) return false;
    return sig.every((byte, i) => bytes[i] === byte);
  });
}

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  detectedType?: "image/jpeg" | "image/png" | "image/webp";
}

/**
 * Validate file extension
 *
 * @param filename - Original filename
 * @returns Validation result
 */
export function validateExtension(filename: string): ValidationResult {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));

  if (
    !IMAGE_LIMITS.allowedExtensions.includes(
      ext as (typeof IMAGE_LIMITS.allowedExtensions)[number]
    )
  ) {
    return {
      valid: false,
      error: `Invalid file extension: ${ext}. Allowed: ${IMAGE_LIMITS.allowedExtensions.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Validate MIME type from Content-Type header
 *
 * @param contentType - Content-Type header value
 * @returns Validation result
 */
export function validateMimeType(contentType: string): ValidationResult {
  // Extract MIME type (ignore charset and other params)
  const mimeType = contentType.split(";")[0].trim().toLowerCase();

  if (
    !IMAGE_LIMITS.allowedMimeTypes.includes(
      mimeType as (typeof IMAGE_LIMITS.allowedMimeTypes)[number]
    )
  ) {
    return {
      valid: false,
      error: `Invalid MIME type: ${mimeType}. Allowed: ${IMAGE_LIMITS.allowedMimeTypes.join(", ")}`,
    };
  }

  return {
    valid: true,
    detectedType: mimeType as ValidationResult["detectedType"],
  };
}

/**
 * Validate file size
 *
 * @param size - File size in bytes
 * @returns Validation result
 */
export function validateFileSize(size: number): ValidationResult {
  if (size <= 0) {
    return {
      valid: false,
      error: "File is empty",
    };
  }

  if (size > IMAGE_LIMITS.maxFileSizeBytes) {
    const maxMB = IMAGE_LIMITS.maxFileSizeBytes / (1024 * 1024);
    return {
      valid: false,
      error: `File size (${(size / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed size (${maxMB} MB)`,
    };
  }

  return { valid: true };
}

/**
 * Validate file by checking magic bytes (file signature)
 *
 * This is the most reliable way to detect actual file type,
 * as it cannot be spoofed by changing extension or Content-Type.
 *
 * @param data - File data as ArrayBuffer
 * @returns Validation result with detected type
 */
export function validateMagicBytes(data: ArrayBuffer): ValidationResult {
  const bytes = new Uint8Array(data.slice(0, 12));

  // Check JPEG
  if (matchesMagicBytes(bytes, MAGIC_BYTES.jpeg)) {
    return { valid: true, detectedType: "image/jpeg" };
  }

  // Check PNG
  if (matchesMagicBytes(bytes, MAGIC_BYTES.png)) {
    return { valid: true, detectedType: "image/png" };
  }

  // Check WebP
  if (isWebP(bytes)) {
    return { valid: true, detectedType: "image/webp" };
  }

  return {
    valid: false,
    error:
      "Invalid file format. File signature does not match any supported image format (JPEG, PNG, WebP)",
  };
}

/**
 * Validate that declared MIME type matches detected type from magic bytes
 *
 * @param declaredType - MIME type from Content-Type header
 * @param detectedType - MIME type detected from magic bytes
 * @returns Validation result
 */
export function validateTypeConsistency(
  declaredType: string,
  detectedType: string
): ValidationResult {
  const normalizedDeclared = declaredType.split(";")[0].trim().toLowerCase();

  if (normalizedDeclared !== detectedType) {
    return {
      valid: false,
      error: `MIME type mismatch: declared ${normalizedDeclared} but detected ${detectedType}`,
    };
  }

  return { valid: true };
}

/**
 * Extract image dimensions from file data
 * Supports JPEG, PNG, and WebP formats
 *
 * @param data - File data as ArrayBuffer
 * @param type - Detected MIME type
 * @returns Dimensions or null if cannot be determined
 */
export function extractImageDimensions(
  data: ArrayBuffer,
  type: "image/jpeg" | "image/png" | "image/webp"
): { width: number; height: number } | null {
  const bytes = new Uint8Array(data);

  try {
    switch (type) {
      case "image/png":
        return extractPngDimensions(bytes);
      case "image/jpeg":
        return extractJpegDimensions(bytes);
      case "image/webp":
        return extractWebPDimensions(bytes);
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Extract dimensions from PNG IHDR chunk
 * PNG format: signature (8 bytes) + IHDR chunk
 * IHDR: length (4) + type (4) + width (4) + height (4) + ...
 */
function extractPngDimensions(
  bytes: Uint8Array
): { width: number; height: number } | null {
  if (bytes.length < 24) return null;

  // Width at offset 16, Height at offset 20 (big-endian)
  const width =
    (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
  const height =
    (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];

  if (width <= 0 || height <= 0) return null;

  return { width, height };
}

/**
 * Extract dimensions from JPEG SOF marker
 * Need to scan for SOF0, SOF1, or SOF2 markers
 */
function extractJpegDimensions(
  bytes: Uint8Array
): { width: number; height: number } | null {
  let offset = 2; // Skip SOI marker

  while (offset < bytes.length - 8) {
    // Find marker
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = bytes[offset + 1];

    // Skip padding FF bytes
    if (marker === 0xff) {
      offset++;
      continue;
    }

    // SOF markers: 0xC0 (baseline), 0xC1, 0xC2 (progressive)
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      // SOF format: length (2) + precision (1) + height (2) + width (2)
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8];

      if (width > 0 && height > 0) {
        return { width, height };
      }
    }

    // Get segment length and skip
    const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
    offset += 2 + segmentLength;
  }

  return null;
}

/**
 * Extract dimensions from WebP VP8/VP8L/VP8X chunk
 */
function extractWebPDimensions(
  bytes: Uint8Array
): { width: number; height: number } | null {
  if (bytes.length < 30) return null;

  // Check chunk type at offset 12
  const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);

  if (chunk === "VP8 ") {
    // Lossy WebP - dimensions at offset 26-29
    // Format: width-1 in 14 bits, height-1 in 14 bits
    if (bytes.length < 30) return null;
    const width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
    const height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
    return { width, height };
  }

  if (chunk === "VP8L") {
    // Lossless WebP - dimensions at offset 21-24
    if (bytes.length < 25) return null;
    const bits =
      bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height };
  }

  if (chunk === "VP8X") {
    // Extended WebP - dimensions at offset 24-29
    if (bytes.length < 30) return null;
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    return { width, height };
  }

  return null;
}

/**
 * Validate image dimensions (prevent decompression bombs)
 *
 * @param dimensions - Image dimensions
 * @returns Validation result
 */
export function validateDimensions(dimensions: {
  width: number;
  height: number;
}): ValidationResult {
  const { width, height } = dimensions;
  const maxDim = IMAGE_LIMITS.maxPixelDimension;

  if (width > maxDim || height > maxDim) {
    return {
      valid: false,
      error: `Image dimensions (${width}x${height}) exceed maximum allowed (${maxDim}x${maxDim})`,
    };
  }

  // Also check total pixel count to prevent memory exhaustion
  const maxPixels = maxDim * maxDim;
  if (width * height > maxPixels) {
    return {
      valid: false,
      error: `Image pixel count exceeds maximum allowed`,
    };
  }

  return { valid: true };
}

/**
 * Comprehensive image file validation
 *
 * Performs all validation checks in order:
 * 1. File size
 * 2. File extension
 * 3. MIME type
 * 4. Magic bytes (file signature)
 * 5. Type consistency (declared vs detected)
 * 6. Image dimensions
 *
 * @param file - File metadata and data
 * @returns Validation result with detected type
 */
export async function validateImageFile(file: {
  filename: string;
  contentType: string;
  size: number;
  data: ArrayBuffer;
}): Promise<ValidationResult> {
  // 1. Validate file size
  const sizeResult = validateFileSize(file.size);
  if (!sizeResult.valid) return sizeResult;

  // 2. Validate extension
  const extResult = validateExtension(file.filename);
  if (!extResult.valid) return extResult;

  // 3. Validate declared MIME type
  const mimeResult = validateMimeType(file.contentType);
  if (!mimeResult.valid) return mimeResult;

  // 4. Validate magic bytes (actual file type)
  const magicResult = validateMagicBytes(file.data);
  if (!magicResult.valid) return magicResult;

  // 5. Validate type consistency
  const consistencyResult = validateTypeConsistency(
    file.contentType,
    magicResult.detectedType!
  );
  if (!consistencyResult.valid) return consistencyResult;

  // 6. Extract and validate dimensions
  const dimensions = extractImageDimensions(
    file.data,
    magicResult.detectedType!
  );
  if (dimensions) {
    const dimResult = validateDimensions(dimensions);
    if (!dimResult.valid) return dimResult;
  }

  return {
    valid: true,
    detectedType: magicResult.detectedType,
  };
}

/**
 * Get normalized file extension from MIME type
 *
 * @param mimeType - MIME type
 * @returns File extension with leading dot
 */
export function getExtensionFromMimeType(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return ".bin";
  }
}
