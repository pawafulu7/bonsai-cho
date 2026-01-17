/**
 * User Profile API Schema Validation Tests
 *
 * Tests for Zod validation schemas in users.schema.ts
 */

import { describe, expect, it } from "vitest";
import {
  type UpdateProfileResponse,
  type UserProfileResponse,
  updateProfileSchema,
  userIdParamSchema,
} from "./users.schema";

describe("users.schema", () => {
  describe("userIdParamSchema", () => {
    it("should accept valid user ID", () => {
      const result = userIdParamSchema.safeParse({ userId: "user123" });
      expect(result.success).toBe(true);
    });

    it("should reject empty user ID", () => {
      const result = userIdParamSchema.safeParse({ userId: "" });
      expect(result.success).toBe(false);
    });

    it("should reject missing user ID", () => {
      const result = userIdParamSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should accept max length user ID (50 chars)", () => {
      const result = userIdParamSchema.safeParse({
        userId: "a".repeat(50),
      });
      expect(result.success).toBe(true);
    });

    it("should reject user ID exceeding max length", () => {
      const result = userIdParamSchema.safeParse({
        userId: "a".repeat(51),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateProfileSchema", () => {
    describe("displayName", () => {
      it("should accept valid display name", () => {
        const result = updateProfileSchema.safeParse({
          displayName: "Test User",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.displayName).toBe("Test User");
        }
      });

      it("should trim whitespace from display name", () => {
        const result = updateProfileSchema.safeParse({
          displayName: "  Test User  ",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.displayName).toBe("Test User");
        }
      });

      it("should transform empty string to null", () => {
        const result = updateProfileSchema.safeParse({
          displayName: "",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.displayName).toBeNull();
        }
      });

      it("should transform whitespace-only string to null", () => {
        const result = updateProfileSchema.safeParse({
          displayName: "   ",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.displayName).toBeNull();
        }
      });

      it("should accept null to clear display name", () => {
        const result = updateProfileSchema.safeParse({
          displayName: null,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.displayName).toBeNull();
        }
      });

      it("should accept max length display name (50 chars)", () => {
        const result = updateProfileSchema.safeParse({
          displayName: "a".repeat(50),
        });
        expect(result.success).toBe(true);
      });

      it("should reject display name exceeding max length", () => {
        const result = updateProfileSchema.safeParse({
          displayName: "a".repeat(51),
        });
        expect(result.success).toBe(false);
      });
    });

    describe("bio", () => {
      it("should accept valid bio", () => {
        const result = updateProfileSchema.safeParse({
          bio: "I love bonsai trees!",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.bio).toBe("I love bonsai trees!");
        }
      });

      it("should accept bio with newlines", () => {
        const result = updateProfileSchema.safeParse({
          bio: "Line 1\nLine 2\nLine 3",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.bio).toBe("Line 1\nLine 2\nLine 3");
        }
      });

      it("should remove control characters from bio", () => {
        const result = updateProfileSchema.safeParse({
          bio: "Hello\x00World\x1F!",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.bio).toBe("HelloWorld!");
        }
      });

      it("should transform empty string to null", () => {
        const result = updateProfileSchema.safeParse({
          bio: "",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.bio).toBeNull();
        }
      });

      it("should accept max length bio (500 chars)", () => {
        const result = updateProfileSchema.safeParse({
          bio: "a".repeat(500),
        });
        expect(result.success).toBe(true);
      });

      it("should reject bio exceeding max length", () => {
        const result = updateProfileSchema.safeParse({
          bio: "a".repeat(501),
        });
        expect(result.success).toBe(false);
      });
    });

    describe("location", () => {
      it("should accept valid location", () => {
        const result = updateProfileSchema.safeParse({
          location: "Tokyo, Japan",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.location).toBe("Tokyo, Japan");
        }
      });

      it("should trim whitespace from location", () => {
        const result = updateProfileSchema.safeParse({
          location: "  Tokyo  ",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.location).toBe("Tokyo");
        }
      });

      it("should transform empty string to null", () => {
        const result = updateProfileSchema.safeParse({
          location: "",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.location).toBeNull();
        }
      });

      it("should accept max length location (100 chars)", () => {
        const result = updateProfileSchema.safeParse({
          location: "a".repeat(100),
        });
        expect(result.success).toBe(true);
      });

      it("should reject location exceeding max length", () => {
        const result = updateProfileSchema.safeParse({
          location: "a".repeat(101),
        });
        expect(result.success).toBe(false);
      });
    });

    describe("website", () => {
      it("should accept valid https URL", () => {
        const result = updateProfileSchema.safeParse({
          website: "https://example.com",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.website).toBe("https://example.com");
        }
      });

      it("should accept valid http URL", () => {
        const result = updateProfileSchema.safeParse({
          website: "http://example.com",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.website).toBe("http://example.com");
        }
      });

      it("should reject URL without http/https scheme", () => {
        const result = updateProfileSchema.safeParse({
          website: "example.com",
        });
        expect(result.success).toBe(false);
      });

      it("should reject ftp URL", () => {
        const result = updateProfileSchema.safeParse({
          website: "ftp://example.com",
        });
        expect(result.success).toBe(false);
      });

      it("should reject javascript: scheme (XSS prevention)", () => {
        const result = updateProfileSchema.safeParse({
          website: "javascript:alert('xss')",
        });
        expect(result.success).toBe(false);
      });

      it("should reject data: scheme (XSS prevention)", () => {
        const result = updateProfileSchema.safeParse({
          website: "data:text/html,<script>alert('xss')</script>",
        });
        expect(result.success).toBe(false);
      });

      it("should reject invalid URL format", () => {
        const result = updateProfileSchema.safeParse({
          website: "not a valid url",
        });
        expect(result.success).toBe(false);
      });

      it("should reject URL with only scheme", () => {
        const result = updateProfileSchema.safeParse({
          website: "https://",
        });
        expect(result.success).toBe(false);
      });

      it("should trim whitespace from URL", () => {
        const result = updateProfileSchema.safeParse({
          website: "  https://example.com  ",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.website).toBe("https://example.com");
        }
      });

      it("should accept URL with path and query", () => {
        const result = updateProfileSchema.safeParse({
          website: "https://example.com/path?query=value",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.website).toBe(
            "https://example.com/path?query=value"
          );
        }
      });

      it("should transform empty string to null", () => {
        const result = updateProfileSchema.safeParse({
          website: "",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.website).toBeNull();
        }
      });

      it("should accept max length website (200 chars)", () => {
        const result = updateProfileSchema.safeParse({
          website: `https://${"a".repeat(192)}`,
        });
        expect(result.success).toBe(true);
      });

      it("should reject website exceeding max length", () => {
        const result = updateProfileSchema.safeParse({
          website: `https://${"a".repeat(193)}`,
        });
        expect(result.success).toBe(false);
      });
    });

    describe("combined fields", () => {
      it("should accept multiple fields at once", () => {
        const result = updateProfileSchema.safeParse({
          displayName: "Bonsai Master",
          bio: "I love bonsai",
          location: "Kyoto",
          website: "https://bonsai.example.com",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.displayName).toBe("Bonsai Master");
          expect(result.data.bio).toBe("I love bonsai");
          expect(result.data.location).toBe("Kyoto");
          expect(result.data.website).toBe("https://bonsai.example.com");
        }
      });

      it("should accept empty object (no fields to update)", () => {
        const result = updateProfileSchema.safeParse({});
        expect(result.success).toBe(true);
      });

      it("should accept partial updates", () => {
        const result = updateProfileSchema.safeParse({
          bio: "Updated bio only",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.bio).toBe("Updated bio only");
          expect(result.data.displayName).toBeUndefined();
        }
      });
    });
  });

  describe("Response Types", () => {
    it("should have correct UserProfileResponse structure", () => {
      const response: UserProfileResponse = {
        id: "user123",
        name: "testuser",
        displayName: "Test User",
        avatarUrl: "https://example.com/avatar.jpg",
        bio: "Bio text",
        location: "Tokyo",
        website: "https://example.com",
        followerCount: 100,
        followingCount: 50,
        bonsaiCount: 10,
        isFollowing: false,
        isSelf: false,
        createdAt: "2024-01-01T00:00:00.000Z",
      };

      expect(response.id).toBe("user123");
      expect(response.bonsaiCount).toBe(10);
      expect(response.isFollowing).toBe(false);
      expect(response.isSelf).toBe(false);
    });

    it("should allow null values for optional fields", () => {
      const response: UserProfileResponse = {
        id: "user123",
        name: "testuser",
        displayName: null,
        avatarUrl: null,
        bio: null,
        location: null,
        website: null,
        followerCount: 0,
        followingCount: 0,
        bonsaiCount: 0,
        isFollowing: null, // Not authenticated
        isSelf: true,
        createdAt: "2024-01-01T00:00:00.000Z",
      };

      expect(response.displayName).toBeNull();
      expect(response.isFollowing).toBeNull();
      expect(response.isSelf).toBe(true);
    });

    it("should have correct UpdateProfileResponse structure", () => {
      const response: UpdateProfileResponse = {
        id: "user123",
        name: "testuser",
        displayName: "Updated Name",
        avatarUrl: "https://example.com/avatar.jpg",
        bio: "Updated bio",
        location: "Osaka",
        website: "https://updated.example.com",
        updatedAt: "2024-01-15T12:00:00.000Z",
      };

      expect(response.id).toBe("user123");
      expect(response.displayName).toBe("Updated Name");
      expect(response.updatedAt).toBe("2024-01-15T12:00:00.000Z");
    });
  });
});
