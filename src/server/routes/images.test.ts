/**
 * Gallery Image API validation tests
 *
 * Tests Zod schemas used in gallery image endpoints.
 * API integration tests would require mocking DB and R2.
 */

import { describe, expect, it, vi } from "vitest";

// Mock thumbnail module to avoid WASM loading issues in Node.js/Vitest
vi.mock("@/lib/image/thumbnail", () => ({
  generateThumbnail: vi.fn(),
  logThumbnailError: vi.fn(),
  ThumbnailGenerationError: class extends Error {
    constructor(
      message: string,
      public code: string,
      public metadata?: unknown
    ) {
      super(message);
      this.name = "ThumbnailGenerationError";
    }
  },
}));

import {
  bonsaiIdParamSchema,
  imageIdParamSchema,
  reorderSchema,
  updateImageSchema,
  uploadQuerySchema,
} from "./images";

describe("Gallery Image API Schemas", () => {
  describe("bonsaiIdParamSchema", () => {
    it("should accept valid bonsai ID", () => {
      const result = bonsaiIdParamSchema.safeParse({ bonsaiId: "abc123" });
      expect(result.success).toBe(true);
    });

    it("should reject empty bonsai ID", () => {
      const result = bonsaiIdParamSchema.safeParse({ bonsaiId: "" });
      expect(result.success).toBe(false);
    });

    it("should reject missing bonsai ID", () => {
      const result = bonsaiIdParamSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("imageIdParamSchema", () => {
    it("should accept valid params", () => {
      const result = imageIdParamSchema.safeParse({
        bonsaiId: "bonsai123",
        imageId: "image456",
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing imageId", () => {
      const result = imageIdParamSchema.safeParse({
        bonsaiId: "bonsai123",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty imageId", () => {
      const result = imageIdParamSchema.safeParse({
        bonsaiId: "bonsai123",
        imageId: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("reorderSchema", () => {
    it("should accept valid image ID array", () => {
      const result = reorderSchema.safeParse({
        imageIds: ["img1", "img2", "img3"],
      });
      expect(result.success).toBe(true);
    });

    it("should accept single image ID", () => {
      const result = reorderSchema.safeParse({
        imageIds: ["img1"],
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty array", () => {
      const result = reorderSchema.safeParse({
        imageIds: [],
      });
      expect(result.success).toBe(false);
    });

    it("should reject array with empty strings", () => {
      const result = reorderSchema.safeParse({
        imageIds: ["img1", "", "img3"],
      });
      expect(result.success).toBe(false);
    });

    it("should reject non-array", () => {
      const result = reorderSchema.safeParse({
        imageIds: "not-an-array",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing imageIds", () => {
      const result = reorderSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("updateImageSchema", () => {
    it("should accept caption only", () => {
      const result = updateImageSchema.safeParse({
        caption: "Beautiful bonsai in spring",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.caption).toBe("Beautiful bonsai in spring");
      }
    });

    it("should accept isPrimary only", () => {
      const result = updateImageSchema.safeParse({
        isPrimary: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isPrimary).toBe(true);
      }
    });

    it("should accept both caption and isPrimary", () => {
      const result = updateImageSchema.safeParse({
        caption: "Main display photo",
        isPrimary: true,
      });
      expect(result.success).toBe(true);
    });

    it("should accept empty object (no updates)", () => {
      const result = updateImageSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should accept empty string caption", () => {
      const result = updateImageSchema.safeParse({
        caption: "",
      });
      expect(result.success).toBe(true);
    });

    it("should reject caption over 500 characters", () => {
      const longCaption = "a".repeat(501);
      const result = updateImageSchema.safeParse({
        caption: longCaption,
      });
      expect(result.success).toBe(false);
    });

    it("should accept caption at 500 characters", () => {
      const maxCaption = "a".repeat(500);
      const result = updateImageSchema.safeParse({
        caption: maxCaption,
      });
      expect(result.success).toBe(true);
    });

    it("should reject non-boolean isPrimary", () => {
      const result = updateImageSchema.safeParse({
        isPrimary: "true",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("uploadQuerySchema", () => {
    it("should accept valid caption and takenAt", () => {
      const result = uploadQuerySchema.safeParse({
        caption: "Spring pruning",
        takenAt: "2024-03-15T10:30:00Z",
      });
      expect(result.success).toBe(true);
    });

    it("should accept caption only", () => {
      const result = uploadQuerySchema.safeParse({
        caption: "Summer growth",
      });
      expect(result.success).toBe(true);
    });

    it("should accept takenAt only", () => {
      const result = uploadQuerySchema.safeParse({
        takenAt: "2024-06-01T14:00:00Z",
      });
      expect(result.success).toBe(true);
    });

    it("should accept empty object", () => {
      const result = uploadQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should reject invalid datetime format", () => {
      const result = uploadQuerySchema.safeParse({
        takenAt: "2024-03-15", // Missing time component
      });
      expect(result.success).toBe(false);
    });

    it("should reject caption over 500 characters", () => {
      const result = uploadQuerySchema.safeParse({
        caption: "x".repeat(501),
      });
      expect(result.success).toBe(false);
    });

    it("should accept various valid datetime formats", () => {
      const validDates = [
        "2024-01-01T00:00:00Z",
        "2024-12-31T23:59:59Z",
        "2024-06-15T12:30:45.123Z",
      ];

      for (const date of validDates) {
        const result = uploadQuerySchema.safeParse({ takenAt: date });
        expect(result.success).toBe(true);
      }
    });
  });
});

describe("Gallery Image API Logic", () => {
  describe("Reorder validation helpers", () => {
    it("should detect duplicate IDs", () => {
      const imageIds = ["img1", "img2", "img1", "img3"];
      const uniqueIds = new Set(imageIds);
      const hasDuplicates = uniqueIds.size !== imageIds.length;
      expect(hasDuplicates).toBe(true);
    });

    it("should pass for unique IDs", () => {
      const imageIds = ["img1", "img2", "img3"];
      const uniqueIds = new Set(imageIds);
      const hasDuplicates = uniqueIds.size !== imageIds.length;
      expect(hasDuplicates).toBe(false);
    });

    it("should detect invalid IDs not in existing set", () => {
      const existingIds = new Set(["img1", "img2", "img3"]);
      const requestedIds = ["img1", "img4", "img2"];
      const invalidIds = requestedIds.filter((id) => !existingIds.has(id));
      expect(invalidIds).toEqual(["img4"]);
    });

    it("should pass when all IDs exist", () => {
      const existingIds = new Set(["img1", "img2", "img3"]);
      const requestedIds = ["img3", "img1", "img2"];
      const invalidIds = requestedIds.filter((id) => !existingIds.has(id));
      expect(invalidIds).toEqual([]);
    });
  });

  describe("Primary image promotion logic", () => {
    it("should promote first remaining image when primary is deleted", () => {
      const images = [
        { id: "img1", isPrimary: true, sortOrder: 0 },
        { id: "img2", isPrimary: false, sortOrder: 1 },
        { id: "img3", isPrimary: false, sortOrder: 2 },
      ];

      // Simulate deleting primary
      const deletedId = "img1";
      const remaining = images
        .filter((img) => img.id !== deletedId)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      // Promote first remaining
      if (remaining.length > 0) {
        remaining[0].isPrimary = true;
      }

      expect(remaining[0].id).toBe("img2");
      expect(remaining[0].isPrimary).toBe(true);
    });

    it("should handle empty remaining images", () => {
      const images = [{ id: "img1", isPrimary: true, sortOrder: 0 }];

      const deletedId = "img1";
      const remaining = images.filter((img) => img.id !== deletedId);

      expect(remaining.length).toBe(0);
    });
  });

  describe("Sort order assignment", () => {
    it("should assign correct sort orders after reorder", () => {
      const newOrder = ["img3", "img1", "img2"];
      const sortedImages = newOrder.map((id, index) => ({
        id,
        sortOrder: index,
      }));

      expect(sortedImages[0]).toEqual({ id: "img3", sortOrder: 0 });
      expect(sortedImages[1]).toEqual({ id: "img1", sortOrder: 1 });
      expect(sortedImages[2]).toEqual({ id: "img2", sortOrder: 2 });
    });
  });
});
