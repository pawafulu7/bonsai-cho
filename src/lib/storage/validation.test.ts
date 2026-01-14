/**
 * Image validation utilities unit tests
 *
 * Tests for file validation functions used in image uploads.
 * Uses Vitest with Node.js environment.
 */

import { describe, expect, it } from "vitest";
import {
  extractImageDimensions,
  getExtensionFromMimeType,
  validateDimensions,
  validateExtension,
  validateFileSize,
  validateImageFile,
  validateMagicBytes,
  validateMimeType,
  validateTypeConsistency,
} from "./validation";

/**
 * Helper to create minimal valid image buffers for testing
 */
function createJpegBuffer(): ArrayBuffer {
  // Minimal JPEG: SOI + APP0 header (JFIF)
  const bytes = new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe0, // SOI + APP0 marker
    0x00,
    0x10, // Length
    0x4a,
    0x46,
    0x49,
    0x46,
    0x00, // "JFIF\0"
    0x01,
    0x01, // Version
    0x00, // Units
    0x00,
    0x01, // X density
    0x00,
    0x01, // Y density
    0x00,
    0x00, // Thumbnail
    // SOF0 marker with dimensions (100x100)
    0xff,
    0xc0,
    0x00,
    0x0b,
    0x08,
    0x00,
    0x64, // Height: 100
    0x00,
    0x64, // Width: 100
    0x01,
    0x00,
  ]);
  return bytes.buffer;
}

function createPngBuffer(width = 100, height = 100): ArrayBuffer {
  // Minimal PNG: signature + IHDR chunk
  const bytes = new Uint8Array([
    // PNG signature
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    // IHDR chunk length (13 bytes)
    0x00,
    0x00,
    0x00,
    0x0d,
    // "IHDR"
    0x49,
    0x48,
    0x44,
    0x52,
    // Width (4 bytes, big-endian)
    (width >> 24) & 0xff,
    (width >> 16) & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    // Height (4 bytes, big-endian)
    (height >> 24) & 0xff,
    (height >> 16) & 0xff,
    (height >> 8) & 0xff,
    height & 0xff,
    // Bit depth, color type, compression, filter, interlace
    0x08,
    0x02,
    0x00,
    0x00,
    0x00,
  ]);
  return bytes.buffer;
}

function createWebPBuffer(): ArrayBuffer {
  // Minimal WebP: RIFF header + VP8X chunk
  const bytes = new Uint8Array([
    // "RIFF"
    0x52, 0x49, 0x46, 0x46,
    // File size (placeholder)
    0x24, 0x00, 0x00, 0x00,
    // "WEBP"
    0x57, 0x45, 0x42, 0x50,
    // "VP8X" chunk
    0x56, 0x50, 0x38, 0x58,
    // Chunk size
    0x0a, 0x00, 0x00, 0x00,
    // Flags
    0x00, 0x00, 0x00, 0x00,
    // Width - 1 (3 bytes, little-endian): 99 = 0x63
    0x63, 0x00, 0x00,
    // Height - 1 (3 bytes, little-endian): 99 = 0x63
    0x63, 0x00, 0x00,
  ]);
  return bytes.buffer;
}

function createInvalidBuffer(): ArrayBuffer {
  // Random bytes that don't match any image signature
  return new Uint8Array([
    0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb,
  ]).buffer;
}

describe("validation", () => {
  describe("validateExtension", () => {
    it("should accept valid extensions", () => {
      expect(validateExtension("photo.jpg")).toEqual({ valid: true });
      expect(validateExtension("photo.jpeg")).toEqual({ valid: true });
      expect(validateExtension("photo.png")).toEqual({ valid: true });
      expect(validateExtension("photo.webp")).toEqual({ valid: true });
    });

    it("should accept uppercase extensions", () => {
      expect(validateExtension("photo.JPG")).toEqual({ valid: true });
      expect(validateExtension("photo.PNG")).toEqual({ valid: true });
      expect(validateExtension("photo.WEBP")).toEqual({ valid: true });
    });

    it("should reject invalid extensions", () => {
      const result = validateExtension("photo.gif");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid file extension");
    });

    it("should reject files without extension", () => {
      const result = validateExtension("photo");
      expect(result.valid).toBe(false);
    });

    it("should handle multiple dots in filename", () => {
      expect(validateExtension("my.photo.jpg")).toEqual({ valid: true });
      expect(validateExtension("photo.backup.png")).toEqual({ valid: true });
    });
  });

  describe("validateMimeType", () => {
    it("should accept valid MIME types", () => {
      expect(validateMimeType("image/jpeg")).toEqual({
        valid: true,
        detectedType: "image/jpeg",
      });
      expect(validateMimeType("image/png")).toEqual({
        valid: true,
        detectedType: "image/png",
      });
      expect(validateMimeType("image/webp")).toEqual({
        valid: true,
        detectedType: "image/webp",
      });
    });

    it("should accept MIME types with charset", () => {
      const result = validateMimeType("image/jpeg; charset=utf-8");
      expect(result.valid).toBe(true);
      expect(result.detectedType).toBe("image/jpeg");
    });

    it("should reject invalid MIME types", () => {
      const result = validateMimeType("image/gif");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid MIME type");
    });

    it("should reject non-image MIME types", () => {
      expect(validateMimeType("text/plain").valid).toBe(false);
      expect(validateMimeType("application/json").valid).toBe(false);
    });
  });

  describe("validateFileSize", () => {
    it("should accept valid file sizes", () => {
      expect(validateFileSize(1024)).toEqual({ valid: true }); // 1KB
      expect(validateFileSize(1024 * 1024)).toEqual({ valid: true }); // 1MB
      expect(validateFileSize(9 * 1024 * 1024)).toEqual({ valid: true }); // 9MB
    });

    it("should accept file at exact limit", () => {
      const result = validateFileSize(10 * 1024 * 1024); // 10MB
      expect(result.valid).toBe(true);
    });

    it("should reject files over limit", () => {
      const result = validateFileSize(11 * 1024 * 1024); // 11MB
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds maximum");
    });

    it("should reject empty files", () => {
      const result = validateFileSize(0);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("empty");
    });

    it("should reject negative size", () => {
      const result = validateFileSize(-1);
      expect(result.valid).toBe(false);
    });
  });

  describe("validateMagicBytes", () => {
    it("should detect JPEG format", () => {
      const result = validateMagicBytes(createJpegBuffer());
      expect(result.valid).toBe(true);
      expect(result.detectedType).toBe("image/jpeg");
    });

    it("should detect PNG format", () => {
      const result = validateMagicBytes(createPngBuffer());
      expect(result.valid).toBe(true);
      expect(result.detectedType).toBe("image/png");
    });

    it("should detect WebP format", () => {
      const result = validateMagicBytes(createWebPBuffer());
      expect(result.valid).toBe(true);
      expect(result.detectedType).toBe("image/webp");
    });

    it("should reject invalid format", () => {
      const result = validateMagicBytes(createInvalidBuffer());
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid file format");
    });

    it("should reject too small buffer", () => {
      const result = validateMagicBytes(new Uint8Array([0xff, 0xd8]).buffer);
      expect(result.valid).toBe(false);
    });

    it("should detect various JPEG markers", () => {
      // EXIF JPEG (0xff 0xd8 0xff 0xe1)
      const exifJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10])
        .buffer;
      expect(validateMagicBytes(exifJpeg).valid).toBe(true);

      // Adobe JPEG (0xff 0xd8 0xff 0xee)
      const adobeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xee, 0x00, 0x10])
        .buffer;
      expect(validateMagicBytes(adobeJpeg).valid).toBe(true);
    });
  });

  describe("validateTypeConsistency", () => {
    it("should accept matching types", () => {
      expect(validateTypeConsistency("image/jpeg", "image/jpeg").valid).toBe(
        true
      );
      expect(validateTypeConsistency("image/png", "image/png").valid).toBe(
        true
      );
      expect(validateTypeConsistency("image/webp", "image/webp").valid).toBe(
        true
      );
    });

    it("should accept declared type with charset", () => {
      const result = validateTypeConsistency(
        "image/jpeg; charset=utf-8",
        "image/jpeg"
      );
      expect(result.valid).toBe(true);
    });

    it("should reject mismatched types", () => {
      const result = validateTypeConsistency("image/jpeg", "image/png");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("mismatch");
    });
  });

  describe("extractImageDimensions", () => {
    it("should extract PNG dimensions", () => {
      const dims = extractImageDimensions(
        createPngBuffer(800, 600),
        "image/png"
      );
      expect(dims).toEqual({ width: 800, height: 600 });
    });

    it("should extract JPEG dimensions", () => {
      const dims = extractImageDimensions(createJpegBuffer(), "image/jpeg");
      expect(dims).toEqual({ width: 100, height: 100 });
    });

    it("should extract WebP dimensions", () => {
      const dims = extractImageDimensions(createWebPBuffer(), "image/webp");
      expect(dims).toEqual({ width: 100, height: 100 });
    });

    it("should return null for invalid data", () => {
      const dims = extractImageDimensions(createInvalidBuffer(), "image/png");
      expect(dims).toBeNull();
    });

    it("should return null for too small buffer", () => {
      const smallBuffer = new Uint8Array(5).buffer;
      expect(extractImageDimensions(smallBuffer, "image/png")).toBeNull();
      expect(extractImageDimensions(smallBuffer, "image/jpeg")).toBeNull();
      expect(extractImageDimensions(smallBuffer, "image/webp")).toBeNull();
    });
  });

  describe("validateDimensions", () => {
    it("should accept valid dimensions", () => {
      expect(validateDimensions({ width: 1920, height: 1080 }).valid).toBe(
        true
      );
      expect(validateDimensions({ width: 3840, height: 2160 }).valid).toBe(
        true
      );
    });

    it("should accept dimensions at limit", () => {
      const result = validateDimensions({ width: 4000, height: 4000 });
      expect(result.valid).toBe(true);
    });

    it("should reject width over limit", () => {
      const result = validateDimensions({ width: 5000, height: 1000 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceed maximum");
    });

    it("should reject height over limit", () => {
      const result = validateDimensions({ width: 1000, height: 5000 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceed maximum");
    });
  });

  describe("validateImageFile", () => {
    it("should accept valid JPEG file", async () => {
      const result = await validateImageFile({
        filename: "photo.jpg",
        contentType: "image/jpeg",
        size: 1024,
        data: createJpegBuffer(),
      });

      expect(result.valid).toBe(true);
      expect(result.detectedType).toBe("image/jpeg");
    });

    it("should accept valid PNG file", async () => {
      const result = await validateImageFile({
        filename: "image.png",
        contentType: "image/png",
        size: 1024,
        data: createPngBuffer(),
      });

      expect(result.valid).toBe(true);
      expect(result.detectedType).toBe("image/png");
    });

    it("should accept valid WebP file", async () => {
      const result = await validateImageFile({
        filename: "image.webp",
        contentType: "image/webp",
        size: 1024,
        data: createWebPBuffer(),
      });

      expect(result.valid).toBe(true);
      expect(result.detectedType).toBe("image/webp");
    });

    it("should reject file with wrong extension", async () => {
      const result = await validateImageFile({
        filename: "photo.gif",
        contentType: "image/jpeg",
        size: 1024,
        data: createJpegBuffer(),
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("extension");
    });

    it("should reject file with wrong MIME type", async () => {
      const result = await validateImageFile({
        filename: "photo.jpg",
        contentType: "image/gif",
        size: 1024,
        data: createJpegBuffer(),
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("MIME type");
    });

    it("should reject file with mismatched type", async () => {
      const result = await validateImageFile({
        filename: "photo.jpg",
        contentType: "image/jpeg",
        size: 1024,
        data: createPngBuffer(), // PNG data but claimed as JPEG
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("mismatch");
    });

    it("should reject oversized file", async () => {
      const result = await validateImageFile({
        filename: "photo.jpg",
        contentType: "image/jpeg",
        size: 15 * 1024 * 1024, // 15MB
        data: createJpegBuffer(),
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds maximum");
    });

    it("should reject empty file", async () => {
      const result = await validateImageFile({
        filename: "photo.jpg",
        contentType: "image/jpeg",
        size: 0,
        data: new ArrayBuffer(0),
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("empty");
    });

    it("should reject oversized dimensions", async () => {
      const result = await validateImageFile({
        filename: "huge.png",
        contentType: "image/png",
        size: 1024,
        data: createPngBuffer(5000, 5000),
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceed maximum");
    });

    it("should reject image when dimension extraction fails", async () => {
      // Create a minimal JPEG that passes magic byte check but has no valid SOF marker
      const corruptedJpeg = new Uint8Array([
        0xff,
        0xd8, // SOI (Start Of Image)
        0xff,
        0xe0, // APP0 marker
        0x00,
        0x10, // Length 16
        0x4a,
        0x46,
        0x49,
        0x46,
        0x00, // JFIF identifier
        0x01,
        0x01, // Version
        0x00, // Density units
        0x00,
        0x01, // X density
        0x00,
        0x01, // Y density
        0x00,
        0x00, // Thumbnail size
        0xff,
        0xd9, // EOI (End Of Image) - no SOF marker!
      ]);

      const result = await validateImageFile({
        filename: "corrupted.jpg",
        contentType: "image/jpeg",
        size: corruptedJpeg.length,
        data: corruptedJpeg.buffer,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Failed to extract image dimensions");
    });
  });

  describe("getExtensionFromMimeType", () => {
    it("should return correct extensions", () => {
      expect(getExtensionFromMimeType("image/jpeg")).toBe(".jpg");
      expect(getExtensionFromMimeType("image/png")).toBe(".png");
      expect(getExtensionFromMimeType("image/webp")).toBe(".webp");
    });

    it("should return .bin for unknown type", () => {
      expect(getExtensionFromMimeType("image/gif")).toBe(".bin");
      expect(getExtensionFromMimeType("text/plain")).toBe(".bin");
    });
  });
});
