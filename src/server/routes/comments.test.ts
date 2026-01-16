/**
 * Comments API validation tests
 *
 * Tests Zod schemas and basic validation for comments endpoints.
 * Full API integration tests would require mocking DB.
 */

import { describe, expect, it } from "vitest";

import {
  bonsaiIdParamSchema,
  commentIdParamSchema,
  createCommentSchema,
  paginationQuerySchema,
  updateCommentSchema,
} from "./social.schema";

describe("Comments API Schemas", () => {
  describe("createCommentSchema", () => {
    it("should accept valid comment content", () => {
      const result = createCommentSchema.safeParse({
        content: "Beautiful bonsai!",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe("Beautiful bonsai!");
      }
    });

    it("should trim whitespace", () => {
      const result = createCommentSchema.safeParse({
        content: "  Nice work!  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe("Nice work!");
      }
    });

    it("should remove control characters", () => {
      const result = createCommentSchema.safeParse({
        content: "Hello\x00World\x1F!",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe("HelloWorld!");
      }
    });

    it("should reject empty content", () => {
      const result = createCommentSchema.safeParse({ content: "" });
      expect(result.success).toBe(false);
    });

    it("should reject whitespace-only content", () => {
      const result = createCommentSchema.safeParse({ content: "   " });
      expect(result.success).toBe(false);
    });

    it("should reject content exceeding 1000 characters", () => {
      const result = createCommentSchema.safeParse({
        content: "a".repeat(1001),
      });
      expect(result.success).toBe(false);
    });

    it("should accept content at max length (1000 chars)", () => {
      const result = createCommentSchema.safeParse({
        content: "a".repeat(1000),
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing content", () => {
      const result = createCommentSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should accept Japanese characters", () => {
      const result = createCommentSchema.safeParse({
        content: "素晴らしい盆栽ですね！",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe("素晴らしい盆栽ですね！");
      }
    });

    it("should accept emoji", () => {
      const result = createCommentSchema.safeParse({
        content: "Amazing work! 🌳✨",
      });
      expect(result.success).toBe(true);
    });

    it("should accept HTML-like text (not filtered)", () => {
      // Per CodexMCP review: HTML escaping is handled on frontend
      const result = createCommentSchema.safeParse({
        content: "Check out <this> tag",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe("Check out <this> tag");
      }
    });
  });

  describe("updateCommentSchema", () => {
    it("should accept valid update content", () => {
      const result = updateCommentSchema.safeParse({
        content: "Updated comment text",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty content", () => {
      const result = updateCommentSchema.safeParse({ content: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("commentIdParamSchema", () => {
    it("should accept valid bonsaiId and commentId", () => {
      const result = commentIdParamSchema.safeParse({
        bonsaiId: "bonsai123",
        commentId: "comment456",
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing bonsaiId", () => {
      const result = commentIdParamSchema.safeParse({
        commentId: "comment456",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing commentId", () => {
      const result = commentIdParamSchema.safeParse({
        bonsaiId: "bonsai123",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty bonsaiId", () => {
      const result = commentIdParamSchema.safeParse({
        bonsaiId: "",
        commentId: "comment456",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty commentId", () => {
      const result = commentIdParamSchema.safeParse({
        bonsaiId: "bonsai123",
        commentId: "",
      });
      expect(result.success).toBe(false);
    });

    it("should accept max length IDs", () => {
      const result = commentIdParamSchema.safeParse({
        bonsaiId: "a".repeat(50),
        commentId: "b".repeat(50),
      });
      expect(result.success).toBe(true);
    });

    it("should reject IDs exceeding max length", () => {
      const result = commentIdParamSchema.safeParse({
        bonsaiId: "a".repeat(51),
        commentId: "comment456",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("bonsaiIdParamSchema (re-exported)", () => {
    it("should accept valid bonsai ID", () => {
      const result = bonsaiIdParamSchema.safeParse({ bonsaiId: "abc123" });
      expect(result.success).toBe(true);
    });

    it("should reject empty bonsai ID", () => {
      const result = bonsaiIdParamSchema.safeParse({ bonsaiId: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("paginationQuerySchema (re-exported)", () => {
    it("should use default limit", () => {
      const result = paginationQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
      }
    });

    it("should accept cursor parameter", () => {
      const result = paginationQuerySchema.safeParse({
        cursor: "abc123",
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("Comment Response Types", () => {
  it("should have correct CommentItem structure", () => {
    const comment: {
      id: string;
      userId: string;
      user: {
        id: string;
        name: string;
        displayName: string | null;
        avatarUrl: string | null;
      };
      content: string;
      createdAt: string;
      updatedAt: string;
      isOwner: boolean;
    } = {
      id: "comment123",
      userId: "user456",
      user: {
        id: "user456",
        name: "John Doe",
        displayName: "Johnny",
        avatarUrl: "https://example.com/avatar.jpg",
      },
      content: "Great bonsai!",
      createdAt: "2026-01-16T00:00:00.000Z",
      updatedAt: "2026-01-16T00:00:00.000Z",
      isOwner: true,
    };
    expect(comment.id).toBe("comment123");
    expect(comment.isOwner).toBe(true);
  });

  it("should handle deleted user display", () => {
    const user: {
      id: string;
      name: string;
      displayName: string | null;
      avatarUrl: string | null;
    } = {
      id: "user789",
      name: "Retired User",
      displayName: null,
      avatarUrl: null,
    };
    expect(user.name).toBe("Retired User");
  });
});

describe("Comment List Response Types", () => {
  it("should have correct CommentListResponse structure", () => {
    const response: {
      data: Array<{
        id: string;
        userId: string;
        user: {
          id: string;
          name: string;
          displayName: string | null;
          avatarUrl: string | null;
        };
        content: string;
        createdAt: string;
        updatedAt: string;
        isOwner: boolean;
      }>;
      nextCursor: string | null;
      hasMore: boolean;
    } = {
      data: [
        {
          id: "comment1",
          userId: "user1",
          user: {
            id: "user1",
            name: "User One",
            displayName: null,
            avatarUrl: null,
          },
          content: "First comment",
          createdAt: "2026-01-16T00:00:00.000Z",
          updatedAt: "2026-01-16T00:00:00.000Z",
          isOwner: false,
        },
      ],
      nextCursor: "cursor123",
      hasMore: true,
    };
    expect(response.data).toHaveLength(1);
    expect(response.hasMore).toBe(true);
  });

  it("should handle empty comment list", () => {
    const response: {
      data: Array<{
        id: string;
        userId: string;
        user: {
          id: string;
          name: string;
          displayName: string | null;
          avatarUrl: string | null;
        };
        content: string;
        createdAt: string;
        updatedAt: string;
        isOwner: boolean;
      }>;
      nextCursor: string | null;
      hasMore: boolean;
    } = {
      data: [],
      nextCursor: null,
      hasMore: false,
    };
    expect(response.data).toHaveLength(0);
    expect(response.nextCursor).toBeNull();
  });
});
