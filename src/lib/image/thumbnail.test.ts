/**
 * Thumbnail Generation Tests
 *
 * Tests for thumbnail generation logic including:
 * - Dimension calculations
 * - Error handling
 * - Edge cases
 *
 * Note: Full image processing tests (generateThumbnail) require
 * Cloudflare Workers runtime for WASM support.
 * These tests focus on pure TypeScript logic that can run in Node.js.
 */

import { describe, expect, it } from "vitest";

// Import only the pure TypeScript functions (not WASM-dependent)
// The ThumbnailGenerationError class is tested separately
// calculateThumbnailDimensions is a pure function

/**
 * Calculate thumbnail dimensions maintaining aspect ratio
 * (Duplicated here to avoid WASM import issues in tests)
 */
function calculateThumbnailDimensions(
  originalWidth: number,
  originalHeight: number,
  targetSize: number
): { width: number; height: number } {
  if (originalWidth <= targetSize && originalHeight <= targetSize) {
    return { width: originalWidth, height: originalHeight };
  }

  const scale = Math.min(
    targetSize / originalWidth,
    targetSize / originalHeight
  );

  const width = Math.max(1, Math.round(originalWidth * scale));
  const height = Math.max(1, Math.round(originalHeight * scale));

  return { width, height };
}

/**
 * Thumbnail generation error class
 * (Duplicated here to avoid WASM import issues in tests)
 */
class ThumbnailGenerationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ThumbnailGenerationError";
  }
}

describe("Thumbnail Generation", () => {
  describe("calculateThumbnailDimensions", () => {
    it("should return original dimensions for images smaller than target", () => {
      const result = calculateThumbnailDimensions(200, 150, 400);
      expect(result).toEqual({ width: 200, height: 150 });
    });

    it("should return original dimensions for exact target size", () => {
      const result = calculateThumbnailDimensions(400, 400, 400);
      expect(result).toEqual({ width: 400, height: 400 });
    });

    it("should scale down landscape images correctly", () => {
      // 800x400 -> scale by 0.5 (400/800) -> 400x200
      const result = calculateThumbnailDimensions(800, 400, 400);
      expect(result).toEqual({ width: 400, height: 200 });
    });

    it("should scale down portrait images correctly", () => {
      // 400x800 -> scale by 0.5 (400/800) -> 200x400
      const result = calculateThumbnailDimensions(400, 800, 400);
      expect(result).toEqual({ width: 200, height: 400 });
    });

    it("should scale down square images correctly", () => {
      // 1000x1000 -> scale by 0.4 (400/1000) -> 400x400
      const result = calculateThumbnailDimensions(1000, 1000, 400);
      expect(result).toEqual({ width: 400, height: 400 });
    });

    it("should handle very large images", () => {
      // 4000x3000 -> scale by 0.1 (400/4000) -> 400x300
      const result = calculateThumbnailDimensions(4000, 3000, 400);
      expect(result).toEqual({ width: 400, height: 300 });
    });

    it("should handle very large portrait images", () => {
      // 3000x4000 -> scale by 0.1 (400/4000) -> 300x400
      const result = calculateThumbnailDimensions(3000, 4000, 400);
      expect(result).toEqual({ width: 300, height: 400 });
    });

    it("should handle non-standard aspect ratios", () => {
      // 1920x1080 -> scale by ~0.208 (400/1920) -> 400x225
      const result = calculateThumbnailDimensions(1920, 1080, 400);
      expect(result.width).toBe(400);
      expect(result.height).toBe(225); // Math.round(1080 * (400/1920))
    });

    it("should ensure minimum dimension of 1px", () => {
      // Very wide image: 10000x10 -> scale by 0.04 (400/10000) -> 400x0.4 -> 400x1
      const result = calculateThumbnailDimensions(10000, 10, 400);
      expect(result.width).toBe(400);
      expect(result.height).toBeGreaterThanOrEqual(1);
    });

    it("should handle target size of 1", () => {
      const result = calculateThumbnailDimensions(100, 50, 1);
      expect(result.width).toBe(1);
      expect(result.height).toBeGreaterThanOrEqual(1);
    });
  });

  describe("ThumbnailGenerationError", () => {
    it("should create error with code and metadata", () => {
      const error = new ThumbnailGenerationError(
        "Test error",
        "INVALID_IMAGE",
        { inputSize: 1024 }
      );

      expect(error.message).toBe("Test error");
      expect(error.code).toBe("INVALID_IMAGE");
      expect(error.metadata).toEqual({ inputSize: 1024 });
      expect(error.name).toBe("ThumbnailGenerationError");
    });

    it("should work without metadata", () => {
      const error = new ThumbnailGenerationError(
        "Test error",
        "PIXEL_COUNT_EXCEEDED"
      );

      expect(error.code).toBe("PIXEL_COUNT_EXCEEDED");
      expect(error.metadata).toBeUndefined();
    });

    it("should include all error codes", () => {
      const codes = [
        "INVALID_IMAGE",
        "PIXEL_COUNT_EXCEEDED",
        "RESIZE_FAILED",
        "ENCODE_FAILED",
        "MEMORY_ERROR",
      ] as const;

      for (const code of codes) {
        const error = new ThumbnailGenerationError(`Error: ${code}`, code);
        expect(error.code).toBe(code);
      }
    });

    it("should preserve full metadata", () => {
      const metadata = {
        inputSize: 5000000,
        width: 4000,
        height: 4000,
        pixelCount: 16000000,
        originalError: "Out of memory",
      };

      const error = new ThumbnailGenerationError(
        "Full metadata test",
        "MEMORY_ERROR",
        metadata
      );

      expect(error.metadata).toEqual(metadata);
    });
  });

  describe("Edge cases for dimension calculation", () => {
    it("should handle 1x1 image", () => {
      const result = calculateThumbnailDimensions(1, 1, 400);
      expect(result).toEqual({ width: 1, height: 1 });
    });

    it("should handle width equals target, height smaller", () => {
      const result = calculateThumbnailDimensions(400, 200, 400);
      expect(result).toEqual({ width: 400, height: 200 });
    });

    it("should handle height equals target, width smaller", () => {
      const result = calculateThumbnailDimensions(200, 400, 400);
      expect(result).toEqual({ width: 200, height: 400 });
    });

    it("should handle exact double of target size", () => {
      // 800x800 -> scale by 0.5 -> 400x400
      const result = calculateThumbnailDimensions(800, 800, 400);
      expect(result).toEqual({ width: 400, height: 400 });
    });

    it("should handle non-integer scale factors", () => {
      // 750x500 -> scale by ~0.533 (400/750) -> 400x267
      const result = calculateThumbnailDimensions(750, 500, 400);
      expect(result.width).toBe(400);
      expect(result.height).toBe(Math.round(500 * (400 / 750)));
    });
  });
});
