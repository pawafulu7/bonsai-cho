/**
 * Database Helper Functions Tests
 *
 * Tests for soft delete filtering and cursor pagination utilities.
 */

import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "./helpers";

describe("helpers", () => {
  describe("cursor pagination", () => {
    describe("encodeCursor", () => {
      it("should encode cursor to base64url format", () => {
        const cursor = {
          createdAt: "2024-01-15T10:30:00.000Z",
          id: "bonsai-123",
        };

        const encoded = encodeCursor(cursor);

        // Should be base64url (no +, /, or = characters)
        expect(encoded).not.toContain("+");
        expect(encoded).not.toContain("/");
        expect(encoded).not.toContain("=");
        expect(encoded.length).toBeGreaterThan(0);
      });

      it("should produce different encodings for different cursors", () => {
        const cursor1 = {
          createdAt: "2024-01-15T10:30:00.000Z",
          id: "bonsai-123",
        };
        const cursor2 = {
          createdAt: "2024-01-16T10:30:00.000Z",
          id: "bonsai-456",
        };

        const encoded1 = encodeCursor(cursor1);
        const encoded2 = encodeCursor(cursor2);

        expect(encoded1).not.toBe(encoded2);
      });

      it("should handle special characters in id", () => {
        const cursor = {
          createdAt: "2024-01-15T10:30:00.000Z",
          id: "bonsai_test-123",
        };

        const encoded = encodeCursor(cursor);
        expect(encoded.length).toBeGreaterThan(0);
      });
    });

    describe("decodeCursor", () => {
      it("should decode valid cursor", () => {
        const originalCursor = {
          createdAt: "2024-01-15T10:30:00.000Z",
          id: "bonsai-123",
        };

        const encoded = encodeCursor(originalCursor);
        const decoded = decodeCursor(encoded);

        expect(decoded).toEqual(originalCursor);
      });

      it("should return null for invalid base64", () => {
        const decoded = decodeCursor("not-valid-base64!!!");

        expect(decoded).toBeNull();
      });

      it("should return null for invalid JSON", () => {
        // Encode invalid JSON as base64url
        const invalidJson = btoa("not json")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=/g, "");

        const decoded = decodeCursor(invalidJson);

        expect(decoded).toBeNull();
      });

      it("should return null for missing createdAt", () => {
        const payload = JSON.stringify({ id: "bonsai-123" });
        const encoded = btoa(payload)
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=/g, "");

        const decoded = decodeCursor(encoded);

        expect(decoded).toBeNull();
      });

      it("should return null for missing id", () => {
        const payload = JSON.stringify({
          createdAt: "2024-01-15T10:30:00.000Z",
        });
        const encoded = btoa(payload)
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=/g, "");

        const decoded = decodeCursor(encoded);

        expect(decoded).toBeNull();
      });

      it("should return null for invalid createdAt date", () => {
        const payload = JSON.stringify({
          createdAt: "not-a-date",
          id: "bonsai-123",
        });
        const encoded = btoa(payload)
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=/g, "");

        const decoded = decodeCursor(encoded);

        expect(decoded).toBeNull();
      });

      it("should return null for non-string createdAt", () => {
        const payload = JSON.stringify({ createdAt: 12345, id: "bonsai-123" });
        const encoded = btoa(payload)
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=/g, "");

        const decoded = decodeCursor(encoded);

        expect(decoded).toBeNull();
      });

      it("should return null for non-string id", () => {
        const payload = JSON.stringify({
          createdAt: "2024-01-15T10:30:00.000Z",
          id: 123,
        });
        const encoded = btoa(payload)
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=/g, "");

        const decoded = decodeCursor(encoded);

        expect(decoded).toBeNull();
      });

      it("should handle padding correctly", () => {
        // Test with different length strings that require different padding
        const cursor1 = {
          createdAt: "2024-01-15T10:30:00.000Z",
          id: "a",
        };
        const cursor2 = {
          createdAt: "2024-01-15T10:30:00.000Z",
          id: "ab",
        };
        const cursor3 = {
          createdAt: "2024-01-15T10:30:00.000Z",
          id: "abc",
        };

        expect(decodeCursor(encodeCursor(cursor1))).toEqual(cursor1);
        expect(decodeCursor(encodeCursor(cursor2))).toEqual(cursor2);
        expect(decodeCursor(encodeCursor(cursor3))).toEqual(cursor3);
      });
    });

    describe("round-trip encoding/decoding", () => {
      it("should preserve cursor data through encode/decode cycle", () => {
        const testCases = [
          { createdAt: "2024-01-01T00:00:00.000Z", id: "id-1" },
          {
            createdAt: "2024-12-31T23:59:59.999Z",
            id: "very-long-id-that-might-cause-issues",
          },
          { createdAt: "2024-06-15T12:00:00.000Z", id: "bonsai_123-456_789" },
        ];

        for (const cursor of testCases) {
          const encoded = encodeCursor(cursor);
          const decoded = decodeCursor(encoded);
          expect(decoded).toEqual(cursor);
        }
      });
    });
  });
});
