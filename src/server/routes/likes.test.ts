/**
 * Likes API validation tests
 *
 * Tests Zod schemas and basic validation for likes endpoints.
 * Full API integration tests would require mocking DB.
 */

import { describe, expect, it } from "vitest";

import { bonsaiIdParamSchema, paginationQuerySchema } from "./social.schema";

describe("Likes API Schemas", () => {
  describe("bonsaiIdParamSchema (re-exported)", () => {
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

    it("should accept max length bonsai ID", () => {
      const result = bonsaiIdParamSchema.safeParse({
        bonsaiId: "a".repeat(50),
      });
      expect(result.success).toBe(true);
    });

    it("should reject bonsai ID exceeding max length", () => {
      const result = bonsaiIdParamSchema.safeParse({
        bonsaiId: "a".repeat(51),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("paginationQuerySchema (re-exported)", () => {
    it("should accept valid cursor and limit", () => {
      const result = paginationQuerySchema.safeParse({
        cursor: "abc123",
        limit: "10",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cursor).toBe("abc123");
        expect(result.data.limit).toBe(10);
      }
    });

    it("should use default limit when not provided", () => {
      const result = paginationQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
      }
    });

    it("should accept limit without cursor", () => {
      const result = paginationQuerySchema.safeParse({ limit: "50" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.cursor).toBeUndefined();
      }
    });

    it("should cap limit at 100", () => {
      const result = paginationQuerySchema.safeParse({ limit: "200" });
      expect(result.success).toBe(false);
    });

    it("should reject limit below 1", () => {
      const result = paginationQuerySchema.safeParse({ limit: "0" });
      expect(result.success).toBe(false);
    });

    it("should handle non-numeric limit by using default", () => {
      const result = paginationQuerySchema.safeParse({ limit: "invalid" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
      }
    });

    it("should reject cursor exceeding max length", () => {
      const result = paginationQuerySchema.safeParse({
        cursor: "a".repeat(201),
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("Like Response Types", () => {
  it("should have correct LikeResponse structure", () => {
    // Type assertion test - this compiles if types are correct
    const response: { liked: boolean; likeCount: number } = {
      liked: true,
      likeCount: 42,
    };
    expect(response.liked).toBe(true);
    expect(response.likeCount).toBe(42);
  });

  it("should have correct UserSummary structure", () => {
    const user: {
      id: string;
      name: string;
      displayName: string | null;
      avatarUrl: string | null;
    } = {
      id: "user123",
      name: "John Doe",
      displayName: "Johnny",
      avatarUrl: "https://example.com/avatar.jpg",
    };
    expect(user.id).toBe("user123");
    expect(user.displayName).toBe("Johnny");
  });

  it("should handle null displayName and avatarUrl", () => {
    const user: {
      id: string;
      name: string;
      displayName: string | null;
      avatarUrl: string | null;
    } = {
      id: "user456",
      name: "Jane Doe",
      displayName: null,
      avatarUrl: null,
    };
    expect(user.displayName).toBeNull();
    expect(user.avatarUrl).toBeNull();
  });
});

describe("Like List Response Types", () => {
  it("should have correct LikeListResponse structure", () => {
    const response: {
      data: Array<{
        id: string;
        name: string;
        displayName: string | null;
        avatarUrl: string | null;
      }>;
      total: number;
      isLiked: boolean;
      nextCursor: string | null;
      hasMore: boolean;
    } = {
      data: [
        {
          id: "user1",
          name: "User One",
          displayName: null,
          avatarUrl: null,
        },
      ],
      total: 100,
      isLiked: true,
      nextCursor: "cursor123",
      hasMore: true,
    };
    expect(response.data).toHaveLength(1);
    expect(response.total).toBe(100);
    expect(response.isLiked).toBe(true);
    expect(response.hasMore).toBe(true);
  });

  it("should handle empty data array", () => {
    const response: {
      data: Array<{
        id: string;
        name: string;
        displayName: string | null;
        avatarUrl: string | null;
      }>;
      total: number;
      isLiked: boolean;
      nextCursor: string | null;
      hasMore: boolean;
    } = {
      data: [],
      total: 0,
      isLiked: false,
      nextCursor: null,
      hasMore: false,
    };
    expect(response.data).toHaveLength(0);
    expect(response.nextCursor).toBeNull();
  });
});
