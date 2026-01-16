/**
 * Social Schema validation tests
 *
 * Comprehensive tests for all Zod schemas in social.schema.ts.
 * Tests validation rules, transformations, and edge cases.
 */

import { describe, expect, it } from "vitest";

import {
  commentIdParamSchema,
  createCommentSchema,
  updateCommentSchema,
  userIdParamSchema,
} from "./social.schema";

describe("Social Schema Validation", () => {
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

    it("should accept min length user ID (1 char)", () => {
      const result = userIdParamSchema.safeParse({ userId: "a" });
      expect(result.success).toBe(true);
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

    it("should accept alphanumeric user ID", () => {
      const result = userIdParamSchema.safeParse({
        userId: "abc123XYZ",
      });
      expect(result.success).toBe(true);
    });

    it("should accept user ID with special characters", () => {
      const result = userIdParamSchema.safeParse({
        userId: "user_123-abc.test",
      });
      expect(result.success).toBe(true);
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

    it("should reject bonsaiId exceeding max length", () => {
      const result = commentIdParamSchema.safeParse({
        bonsaiId: "a".repeat(51),
        commentId: "comment456",
      });
      expect(result.success).toBe(false);
    });

    it("should reject commentId exceeding max length", () => {
      const result = commentIdParamSchema.safeParse({
        bonsaiId: "bonsai123",
        commentId: "b".repeat(51),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createCommentSchema", () => {
    describe("valid content", () => {
      it("should accept normal comment", () => {
        const result = createCommentSchema.safeParse({
          content: "Beautiful bonsai!",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.content).toBe("Beautiful bonsai!");
        }
      });

      it("should accept single character", () => {
        const result = createCommentSchema.safeParse({
          content: "a",
        });
        expect(result.success).toBe(true);
      });

      it("should accept max length content (1000 chars)", () => {
        const result = createCommentSchema.safeParse({
          content: "a".repeat(1000),
        });
        expect(result.success).toBe(true);
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
          content: "Amazing work! 🌳✨🎋",
        });
        expect(result.success).toBe(true);
      });

      it("should accept mixed content", () => {
        const result = createCommentSchema.safeParse({
          content: "Great 盆栽! 🌳 Very nice",
        });
        expect(result.success).toBe(true);
      });

      it("should accept HTML-like text (not filtered)", () => {
        // HTML escaping is handled on frontend (React auto-escapes)
        const result = createCommentSchema.safeParse({
          content: "Check out <this> tag & more",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.content).toBe("Check out <this> tag & more");
        }
      });

      it("should accept newlines and tabs", () => {
        const result = createCommentSchema.safeParse({
          content: "Line 1\nLine 2\tTabbed",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.content).toBe("Line 1\nLine 2\tTabbed");
        }
      });
    });

    describe("whitespace handling", () => {
      it("should trim leading whitespace", () => {
        const result = createCommentSchema.safeParse({
          content: "   Nice work!",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.content).toBe("Nice work!");
        }
      });

      it("should trim trailing whitespace", () => {
        const result = createCommentSchema.safeParse({
          content: "Nice work!   ",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.content).toBe("Nice work!");
        }
      });

      it("should trim both sides", () => {
        const result = createCommentSchema.safeParse({
          content: "  Nice work!  ",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.content).toBe("Nice work!");
        }
      });

      it("should preserve internal whitespace", () => {
        const result = createCommentSchema.safeParse({
          content: "Nice   work!",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.content).toBe("Nice   work!");
        }
      });
    });

    describe("control character removal", () => {
      it("should remove null character", () => {
        const result = createCommentSchema.safeParse({
          content: "Hello\x00World",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.content).toBe("HelloWorld");
        }
      });

      it("should remove multiple control characters", () => {
        const result = createCommentSchema.safeParse({
          content: "Hello\x00\x01\x1FWorld\x7F!",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.content).toBe("HelloWorld!");
        }
      });

      it("should preserve newline (\\x0A)", () => {
        const result = createCommentSchema.safeParse({
          content: "Hello\nWorld",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.content).toBe("Hello\nWorld");
        }
      });

      it("should preserve carriage return (\\x0D)", () => {
        const result = createCommentSchema.safeParse({
          content: "Hello\rWorld",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.content).toBe("Hello\rWorld");
        }
      });

      it("should preserve tab (\\x09)", () => {
        const result = createCommentSchema.safeParse({
          content: "Hello\tWorld",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.content).toBe("Hello\tWorld");
        }
      });
    });

    describe("invalid content", () => {
      it("should reject empty content", () => {
        const result = createCommentSchema.safeParse({ content: "" });
        expect(result.success).toBe(false);
      });

      it("should reject whitespace-only content", () => {
        const result = createCommentSchema.safeParse({ content: "   " });
        expect(result.success).toBe(false);
      });

      it("should reject tabs-only content", () => {
        const result = createCommentSchema.safeParse({ content: "\t\t" });
        expect(result.success).toBe(false);
      });

      it("should reject newlines-only content", () => {
        const result = createCommentSchema.safeParse({ content: "\n\n" });
        expect(result.success).toBe(false);
      });

      it("should reject control-characters-only content", () => {
        const result = createCommentSchema.safeParse({
          content: "\x00\x01\x02",
        });
        expect(result.success).toBe(false);
      });

      it("should reject content exceeding 1000 characters", () => {
        const result = createCommentSchema.safeParse({
          content: "a".repeat(1001),
        });
        expect(result.success).toBe(false);
      });

      it("should reject missing content", () => {
        const result = createCommentSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it("should reject non-string content", () => {
        const result = createCommentSchema.safeParse({ content: 123 });
        expect(result.success).toBe(false);
      });

      it("should reject null content", () => {
        const result = createCommentSchema.safeParse({ content: null });
        expect(result.success).toBe(false);
      });
    });

    describe("edge cases", () => {
      it("should handle content that becomes empty after transform", () => {
        // Whitespace + control chars only
        const result = createCommentSchema.safeParse({
          content: "  \x00\x01  ",
        });
        expect(result.success).toBe(false);
      });

      it("should reject content that exceeds max length before trim", () => {
        // max(1000) is applied BEFORE trim, so "  " + 1000 chars + "  " = 1004 chars
        const result = createCommentSchema.safeParse({
          content: `  ${"a".repeat(1000)}  `,
        });
        expect(result.success).toBe(false);
      });

      it("should accept content within max length with whitespace", () => {
        // 996 chars + 4 whitespace = 1000 chars
        const result = createCommentSchema.safeParse({
          content: `  ${"a".repeat(996)}  `,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.content).toBe("a".repeat(996));
        }
      });

      it("should handle unicode emoji (surrogate pairs)", () => {
        // Tree emoji 🌳 has string length of 2 (surrogate pair)
        // So 500 emoji = 1000 characters in JS string length
        const result = createCommentSchema.safeParse({
          content: "🌳".repeat(500),
        });
        expect(result.success).toBe(true);
      });

      it("should reject too many emoji", () => {
        // 501 emoji = 1002 characters, exceeds max
        const result = createCommentSchema.safeParse({
          content: "🌳".repeat(501),
        });
        expect(result.success).toBe(false);
      });
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

    it("should apply same transformations as create", () => {
      const result = updateCommentSchema.safeParse({
        content: "  Updated\x00text  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe("Updatedtext");
      }
    });
  });
});
