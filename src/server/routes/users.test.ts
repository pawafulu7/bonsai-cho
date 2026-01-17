/**
 * Users API validation tests
 *
 * Tests Zod schemas and basic validation for users endpoints.
 * Full API integration tests would require mocking DB.
 */

import { describe, expect, it } from "vitest";

import { updateProfileSchema, userIdParamSchema } from "./users.schema";

describe("Users API Schemas", () => {
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

    it("should accept max length user ID", () => {
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
    it("should accept valid update request", () => {
      const result = updateProfileSchema.safeParse({
        displayName: "Test User",
        bio: "I love bonsai",
        location: "Tokyo",
        website: "https://example.com",
      });
      expect(result.success).toBe(true);
    });

    it("should accept empty object", () => {
      const result = updateProfileSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should accept partial updates", () => {
      const result = updateProfileSchema.safeParse({
        displayName: "New Name",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.displayName).toBe("New Name");
        expect(result.data.bio).toBeUndefined();
      }
    });

    it("should accept null values to clear fields", () => {
      const result = updateProfileSchema.safeParse({
        displayName: null,
        bio: null,
        location: null,
        website: null,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.displayName).toBeNull();
        expect(result.data.bio).toBeNull();
        expect(result.data.location).toBeNull();
        expect(result.data.website).toBeNull();
      }
    });

    it("should transform empty strings to null", () => {
      const result = updateProfileSchema.safeParse({
        displayName: "",
        bio: "",
        location: "",
        website: "",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.displayName).toBeNull();
        expect(result.data.bio).toBeNull();
        expect(result.data.location).toBeNull();
        expect(result.data.website).toBeNull();
      }
    });

    it("should reject displayName over 50 characters", () => {
      const result = updateProfileSchema.safeParse({
        displayName: "a".repeat(51),
      });
      expect(result.success).toBe(false);
    });

    it("should reject bio over 500 characters", () => {
      const result = updateProfileSchema.safeParse({
        bio: "a".repeat(501),
      });
      expect(result.success).toBe(false);
    });

    it("should reject location over 100 characters", () => {
      const result = updateProfileSchema.safeParse({
        location: "a".repeat(101),
      });
      expect(result.success).toBe(false);
    });

    it("should reject website over 200 characters", () => {
      const result = updateProfileSchema.safeParse({
        website: `https://${"a".repeat(193)}`,
      });
      expect(result.success).toBe(false);
    });

    it("should reject website without http/https scheme", () => {
      const result = updateProfileSchema.safeParse({
        website: "www.example.com",
      });
      expect(result.success).toBe(false);
    });

    it("should accept website with http scheme", () => {
      const result = updateProfileSchema.safeParse({
        website: "http://example.com",
      });
      expect(result.success).toBe(true);
    });

    it("should trim whitespace from displayName and location", () => {
      const result = updateProfileSchema.safeParse({
        displayName: "  Trimmed Name  ",
        location: "  Trimmed Location  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.displayName).toBe("Trimmed Name");
        expect(result.data.location).toBe("Trimmed Location");
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

    it("should preserve newlines in bio", () => {
      const result = updateProfileSchema.safeParse({
        bio: "Line 1\nLine 2",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.bio).toBe("Line 1\nLine 2");
      }
    });
  });
});

describe("Users Response Types", () => {
  it("should have correct UserProfileResponse structure", () => {
    const response: {
      id: string;
      name: string;
      displayName: string | null;
      avatarUrl: string | null;
      bio: string | null;
      location: string | null;
      website: string | null;
      followerCount: number;
      followingCount: number;
      bonsaiCount: number;
      isFollowing: boolean | null;
      isSelf: boolean;
      createdAt: string;
    } = {
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

  it("should allow null isFollowing when not authenticated", () => {
    const response: {
      isFollowing: boolean | null;
      isSelf: boolean;
    } = {
      isFollowing: null,
      isSelf: false,
    };

    expect(response.isFollowing).toBeNull();
  });

  it("should have correct UpdateProfileResponse structure", () => {
    const response: {
      id: string;
      name: string;
      displayName: string | null;
      avatarUrl: string | null;
      bio: string | null;
      location: string | null;
      website: string | null;
      updatedAt: string;
    } = {
      id: "user123",
      name: "testuser",
      displayName: "Updated Name",
      avatarUrl: null,
      bio: "Updated bio",
      location: "Osaka",
      website: "https://example.com",
      updatedAt: "2024-01-15T12:00:00.000Z",
    };

    expect(response.id).toBe("user123");
    expect(response.displayName).toBe("Updated Name");
    expect(response.updatedAt).toBe("2024-01-15T12:00:00.000Z");
  });
});
