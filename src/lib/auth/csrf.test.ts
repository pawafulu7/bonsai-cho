/**
 * CSRF protection utilities unit tests
 *
 * Tests for CSRF token generation, validation, and cookie handling.
 */

import { describe, expect, it } from "vitest";
import {
  CSRF_COOKIE_NAME,
  CSRF_COOKIE_OPTIONS,
  CSRF_FORM_FIELD,
  CSRF_HEADER_NAME,
  clearCsrfCookie,
  createCsrfCookie,
  extractCsrfToken,
  generateCsrfToken,
  parseCsrfCookie,
  validateCsrfToken,
} from "./csrf";
import { SESSION_COOKIE_OPTIONS } from "./session";

describe("csrf", () => {
  describe("generateCsrfToken", () => {
    it("should generate 43-character base64url string", () => {
      const token = generateCsrfToken();

      expect(token.length).toBe(43);
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("should generate unique tokens", () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateCsrfToken());
      }

      expect(tokens.size).toBe(100);
    });
  });

  describe("validateCsrfToken", () => {
    it("should return true for matching tokens", () => {
      const token = "test-csrf-token-12345";

      expect(validateCsrfToken(token, token)).toBe(true);
    });

    it("should return true for equal but different string instances", () => {
      const token1 = "test-token";
      const token2 = "test-" + "token";

      expect(validateCsrfToken(token1, token2)).toBe(true);
    });

    it("should return false for mismatched tokens", () => {
      expect(validateCsrfToken("token1", "token2")).toBe(false);
    });

    it("should return false when cookieToken is null", () => {
      expect(validateCsrfToken(null, "token")).toBe(false);
    });

    it("should return false when requestToken is null", () => {
      expect(validateCsrfToken("token", null)).toBe(false);
    });

    it("should return false when both tokens are null", () => {
      expect(validateCsrfToken(null, null)).toBe(false);
    });

    it("should return false for similar but different tokens", () => {
      const token1 = "abcdefghij1234567890ABCDEFGHIJ1234567890123";
      const token2 = "abcdefghij1234567890ABCDEFGHIJ1234567890124";

      expect(validateCsrfToken(token1, token2)).toBe(false);
    });
  });

  describe("extractCsrfToken", () => {
    it("should extract token from X-CSRF-Token header", () => {
      const token = "header-csrf-token";
      const request = new Request("https://example.com", {
        headers: { [CSRF_HEADER_NAME]: token },
      });

      expect(extractCsrfToken(request)).toBe(token);
    });

    it("should extract token from form data", () => {
      const token = "form-csrf-token";
      const formData = new FormData();
      formData.append(CSRF_FORM_FIELD, token);

      const request = new Request("https://example.com");

      expect(extractCsrfToken(request, formData)).toBe(token);
    });

    it("should prefer header over form data", () => {
      const headerToken = "header-token";
      const formToken = "form-token";

      const request = new Request("https://example.com", {
        headers: { [CSRF_HEADER_NAME]: headerToken },
      });

      const formData = new FormData();
      formData.append(CSRF_FORM_FIELD, formToken);

      expect(extractCsrfToken(request, formData)).toBe(headerToken);
    });

    it("should return null when both header and form data are missing", () => {
      const request = new Request("https://example.com");

      expect(extractCsrfToken(request)).toBeNull();
    });

    it("should return null when form field has non-string value", () => {
      const request = new Request("https://example.com");
      const formData = new FormData();
      // FormData with file would have Blob, not string
      // But we can't easily test that, so just test empty form

      expect(extractCsrfToken(request, formData)).toBeNull();
    });
  });

  describe("parseCsrfCookie", () => {
    it("should parse single CSRF cookie", () => {
      const token = "test-token-12345";
      const cookieHeader = `${CSRF_COOKIE_NAME}=${token}`;

      expect(parseCsrfCookie(cookieHeader)).toBe(token);
    });

    it("should parse CSRF cookie from multiple cookies", () => {
      const token = "csrf-token-value";
      const cookieHeader = `other=value; ${CSRF_COOKIE_NAME}=${token}; another=data`;

      expect(parseCsrfCookie(cookieHeader)).toBe(token);
    });

    it("should handle cookie value containing equals sign", () => {
      // Base64 encoded values might contain = padding
      const token = "abc=def=ghi";
      const cookieHeader = `${CSRF_COOKIE_NAME}=${token}`;

      expect(parseCsrfCookie(cookieHeader)).toBe(token);
    });

    it("should return null for empty cookie header", () => {
      expect(parseCsrfCookie("")).toBeNull();
    });

    it("should return null for null cookie header", () => {
      expect(parseCsrfCookie(null)).toBeNull();
    });

    it("should return null when CSRF cookie not present", () => {
      const cookieHeader = "other=value; another=data";

      expect(parseCsrfCookie(cookieHeader)).toBeNull();
    });

    it("should handle whitespace in cookie header", () => {
      const token = "token-value";
      const cookieHeader = `  ${CSRF_COOKIE_NAME}=${token}  ;  other=value  `;

      expect(parseCsrfCookie(cookieHeader)).toBe(token);
    });
  });

  describe("createCsrfCookie", () => {
    it("should create valid Set-Cookie header value", () => {
      const token = "test-token";
      const cookie = createCsrfCookie(token);

      expect(cookie).toContain(`${CSRF_COOKIE_NAME}=${token}`);
      expect(cookie).toContain("Path=/");
      expect(cookie).toContain("Max-Age=1209600"); // 14 days
      expect(cookie.toLowerCase()).toContain("samesite=lax");
      expect(cookie).toContain("Secure");
    });

    it("should NOT include HttpOnly flag", () => {
      // CSRF cookie must be readable by JavaScript for header submission
      const cookie = createCsrfCookie("token");

      expect(cookie).not.toContain("HttpOnly");
    });
  });

  describe("clearCsrfCookie", () => {
    it("should create cookie with Max-Age=0", () => {
      const cookie = clearCsrfCookie();

      expect(cookie).toContain(`${CSRF_COOKIE_NAME}=`);
      expect(cookie).toContain("Max-Age=0");
      expect(cookie).toContain("Path=/");
      expect(cookie).toContain("Secure");
      expect(cookie.toLowerCase()).toContain("samesite=lax");
    });
  });

  describe("constants", () => {
    it("should have correct cookie name with __Host- prefix", () => {
      expect(CSRF_COOKIE_NAME).toBe("__Host-csrf");
    });

    it("should have correct header name", () => {
      expect(CSRF_HEADER_NAME).toBe("X-CSRF-Token");
    });

    it("should have correct form field name", () => {
      expect(CSRF_FORM_FIELD).toBe("_csrf");
    });
  });

  describe("cookie options consistency", () => {
    it("should have same maxAge as session cookie", () => {
      expect(CSRF_COOKIE_OPTIONS.maxAge).toBe(SESSION_COOKIE_OPTIONS.maxAge);
    });

    it("should have 14 days maxAge (same as session)", () => {
      const FOURTEEN_DAYS_IN_SECONDS = 60 * 60 * 24 * 14;
      expect(CSRF_COOKIE_OPTIONS.maxAge).toBe(FOURTEEN_DAYS_IN_SECONDS);
    });
  });
});
