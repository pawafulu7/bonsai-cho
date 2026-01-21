/**
 * Rate limiting middleware unit tests
 *
 * Tests for path matching, rate limit checking, and KV operations.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Context } from "hono";
import {
  matchPath,
  findMatchingRule,
  generateRateLimitKey,
  getClientIp,
  checkRateLimit,
  createMockKV,
  DEFAULT_RATE_LIMIT_RULES,
  type RateLimitRule,
  type KVNamespace,
} from "./rate-limit";

describe("rate-limit", () => {
  describe("matchPath", () => {
    it("should match exact paths", () => {
      expect(matchPath("/api/bonsai", "/api/bonsai")).toBe(true);
      expect(matchPath("/api/auth/login", "/api/auth/login")).toBe(true);
    });

    it("should not match different paths", () => {
      expect(matchPath("/api/bonsai", "/api/users")).toBe(false);
      expect(matchPath("/api/auth", "/api/auth/login")).toBe(false);
    });

    it("should match single segment wildcard (*)", () => {
      expect(matchPath("/api/bonsai/*/images", "/api/bonsai/123/images")).toBe(true);
      expect(matchPath("/api/bonsai/*/images", "/api/bonsai/abc-def/images")).toBe(true);
      expect(matchPath("/api/auth/*", "/api/auth/login")).toBe(true);
      expect(matchPath("/api/auth/*", "/api/auth/logout")).toBe(true);
    });

    it("should not match multiple segments with single wildcard", () => {
      expect(matchPath("/api/bonsai/*", "/api/bonsai/123/images")).toBe(false);
    });

    it("should match wildcards at different positions", () => {
      expect(matchPath("/api/*/comments", "/api/bonsai/comments")).toBe(true);
      expect(matchPath("/*/*/likes", "/api/bonsai/likes")).toBe(true);
    });
  });

  describe("findMatchingRule", () => {
    const testRules: RateLimitRule[] = [
      {
        method: "POST",
        pattern: "/api/auth/*",
        config: { maxRequests: 10, windowSeconds: 60, keyPrefix: "auth" },
      },
      {
        method: "POST",
        pattern: "/api/bonsai/*/images",
        config: { maxRequests: 20, windowSeconds: 3600, keyPrefix: "img" },
      },
      {
        method: "*",
        pattern: "/api/*",
        config: { maxRequests: 100, windowSeconds: 3600, keyPrefix: "default" },
      },
    ];

    it("should find exact matching rule", () => {
      const rule = findMatchingRule("POST", "/api/auth/login", testRules);
      expect(rule).not.toBeNull();
      expect(rule?.config.keyPrefix).toBe("auth");
    });

    it("should find wildcard matching rule", () => {
      const rule = findMatchingRule("POST", "/api/bonsai/123/images", testRules);
      expect(rule).not.toBeNull();
      expect(rule?.config.keyPrefix).toBe("img");
    });

    it("should return first matching rule (most specific first)", () => {
      // auth/* should match before generic api/*
      const rule = findMatchingRule("POST", "/api/auth/callback", testRules);
      expect(rule?.config.keyPrefix).toBe("auth");
    });

    it("should match by method", () => {
      // GET /api/auth/me should not match POST-only auth rule
      // Note: /api/* only matches single segment, so /api/auth/me won't match
      const rule = findMatchingRule("GET", "/api/auth/me", testRules);
      expect(rule).toBeNull();

      // GET /api/users should match the wildcard method rule
      const rule2 = findMatchingRule("GET", "/api/users", testRules);
      expect(rule2?.config.keyPrefix).toBe("default");
    });

    it("should return null when no rule matches", () => {
      const rule = findMatchingRule("GET", "/health", testRules);
      expect(rule).toBeNull();
    });

    it("should match wildcard method (*)", () => {
      const rule = findMatchingRule("DELETE", "/api/something", testRules);
      expect(rule).not.toBeNull();
      expect(rule?.config.keyPrefix).toBe("default");
    });
  });

  describe("generateRateLimitKey", () => {
    it("should generate key for authenticated user", () => {
      const key = generateRateLimitKey("auth", "user-123", "192.168.1.1");
      expect(key).toBe("rate:auth:user:user-123");
    });

    it("should generate key for unauthenticated user using IP", () => {
      const key = generateRateLimitKey("auth", null, "192.168.1.1");
      expect(key).toBe("rate:auth:ip:192.168.1.1");
    });

    it("should handle different prefixes", () => {
      const key = generateRateLimitKey("img", "user-456", "10.0.0.1");
      expect(key).toBe("rate:img:user:user-456");
    });
  });

  describe("getClientIp", () => {
    function createMockContext(headers: Record<string, string>): Context {
      return {
        req: {
          header: (name: string) => headers[name] || null,
        },
      } as unknown as Context;
    }

    it("should prefer CF-Connecting-IP header", () => {
      const c = createMockContext({
        "CF-Connecting-IP": "1.2.3.4",
        "X-Forwarded-For": "5.6.7.8",
        "X-Real-IP": "9.10.11.12",
      });
      expect(getClientIp(c)).toBe("1.2.3.4");
    });

    it("should fall back to X-Forwarded-For", () => {
      const c = createMockContext({
        "X-Forwarded-For": "5.6.7.8, 10.0.0.1",
        "X-Real-IP": "9.10.11.12",
      });
      expect(getClientIp(c)).toBe("5.6.7.8");
    });

    it("should parse first IP from X-Forwarded-For chain", () => {
      const c = createMockContext({
        "X-Forwarded-For": "1.1.1.1, 2.2.2.2, 3.3.3.3",
      });
      expect(getClientIp(c)).toBe("1.1.1.1");
    });

    it("should fall back to X-Real-IP", () => {
      const c = createMockContext({
        "X-Real-IP": "9.10.11.12",
      });
      expect(getClientIp(c)).toBe("9.10.11.12");
    });

    it("should return 'unknown' when no headers present", () => {
      const c = createMockContext({});
      expect(getClientIp(c)).toBe("unknown");
    });
  });

  describe("checkRateLimit", () => {
    let mockKv: KVNamespace;

    beforeEach(() => {
      mockKv = createMockKV();
    });

    it("should allow first request", async () => {
      const result = await checkRateLimit(mockKv, "test-key", {
        maxRequests: 10,
        windowSeconds: 60,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it("should decrement remaining count on each request", async () => {
      const config = { maxRequests: 5, windowSeconds: 60 };
      const key = "test-key";

      const result1 = await checkRateLimit(mockKv, key, config);
      expect(result1.remaining).toBe(4);

      const result2 = await checkRateLimit(mockKv, key, config);
      expect(result2.remaining).toBe(3);

      const result3 = await checkRateLimit(mockKv, key, config);
      expect(result3.remaining).toBe(2);
    });

    it("should deny when limit exceeded", async () => {
      const config = { maxRequests: 2, windowSeconds: 60 };
      const key = "limit-test";

      await checkRateLimit(mockKv, key, config); // 1
      await checkRateLimit(mockKv, key, config); // 2

      const result = await checkRateLimit(mockKv, key, config); // 3 - should be denied

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it("should return retryAfter for denied requests", async () => {
      const config = { maxRequests: 1, windowSeconds: 60 };
      const key = "retry-test";

      await checkRateLimit(mockKv, key, config); // Use up the limit

      const result = await checkRateLimit(mockKv, key, config);

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeLessThanOrEqual(60);
    });

    it("should track separate keys independently", async () => {
      const config = { maxRequests: 2, windowSeconds: 60 };

      await checkRateLimit(mockKv, "key-a", config);
      await checkRateLimit(mockKv, "key-a", config);

      // key-a is exhausted
      const resultA = await checkRateLimit(mockKv, "key-a", config);
      expect(resultA.allowed).toBe(false);

      // key-b should still be available
      const resultB = await checkRateLimit(mockKv, "key-b", config);
      expect(resultB.allowed).toBe(true);
      expect(resultB.remaining).toBe(1);
    });
  });

  describe("createMockKV", () => {
    it("should store and retrieve values", async () => {
      const kv = createMockKV();

      await kv.put("test-key", "test-value");
      const result = await kv.get("test-key");

      expect(result).toBe("test-value");
    });

    it("should return null for non-existent keys", async () => {
      const kv = createMockKV();
      const result = await kv.get("nonexistent");

      expect(result).toBeNull();
    });

    it("should delete keys", async () => {
      const kv = createMockKV();

      await kv.put("delete-me", "value");
      await kv.delete("delete-me");
      const result = await kv.get("delete-me");

      expect(result).toBeNull();
    });

    it("should handle TTL expiration", async () => {
      const kv = createMockKV();

      // Store with 1 second TTL (but mock uses seconds, not milliseconds)
      await kv.put("expire-key", "value", { expirationTtl: 1 });

      // Immediately should work
      const beforeExpire = await kv.get("expire-key");
      expect(beforeExpire).toBe("value");

      // Note: Testing actual expiration would require mocking time
      // The implementation checks Date.now() / 1000 > expiresAt
    });
  });

  describe("DEFAULT_RATE_LIMIT_RULES", () => {
    it("should have auth rules with strict limits", () => {
      const authRule = DEFAULT_RATE_LIMIT_RULES.find(
        (r) => r.pattern === "/api/auth/*"
      );
      expect(authRule).toBeDefined();
      expect(authRule?.config.maxRequests).toBe(10);
      expect(authRule?.config.windowSeconds).toBe(60);
    });

    it("should have image upload rules", () => {
      const imageRule = DEFAULT_RATE_LIMIT_RULES.find(
        (r) => r.pattern === "/api/bonsai/*/images"
      );
      expect(imageRule).toBeDefined();
      expect(imageRule?.config.maxRequests).toBe(20);
      expect(imageRule?.config.windowSeconds).toBe(3600);
    });

    it("should have bonsai creation rules", () => {
      const bonsaiRule = DEFAULT_RATE_LIMIT_RULES.find(
        (r) => r.pattern === "/api/bonsai" && r.method === "POST"
      );
      expect(bonsaiRule).toBeDefined();
      expect(bonsaiRule?.config.maxRequests).toBe(30);
    });

    it("should have default fallback rules", () => {
      const postRule = DEFAULT_RATE_LIMIT_RULES.find(
        (r) => r.pattern === "/api/*" && r.method === "POST"
      );
      const patchRule = DEFAULT_RATE_LIMIT_RULES.find(
        (r) => r.pattern === "/api/*" && r.method === "PATCH"
      );
      const deleteRule = DEFAULT_RATE_LIMIT_RULES.find(
        (r) => r.pattern === "/api/*" && r.method === "DELETE"
      );

      expect(postRule).toBeDefined();
      expect(patchRule).toBeDefined();
      expect(deleteRule).toBeDefined();
    });
  });
});
