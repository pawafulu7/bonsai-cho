/**
 * Rate limiting middleware using Cloudflare KV
 *
 * Implements a sliding window rate limiting algorithm.
 * Uses KV for distributed rate limit tracking across edge locations.
 *
 * Note: KV has eventual consistency, so rate limits may not be perfectly
 * accurate across edge locations. This is acceptable for our use case.
 */

import type { Context, MiddlewareHandler, Next } from "hono";

/**
 * KVNamespace interface for Cloudflare KV
 */
export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Rate limit configuration for a specific endpoint pattern
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Optional key prefix for this rule */
  keyPrefix?: string;
}

/**
 * Rate limit rule with endpoint matching
 */
export interface RateLimitRule {
  /** HTTP method to match (or "*" for all) */
  method: string;
  /** URL path pattern (supports wildcards like /api/bonsai/:id/images) */
  pattern: string;
  /** Rate limit configuration */
  config: RateLimitConfig;
}

/**
 * Rate limit state stored in KV
 */
interface RateLimitState {
  /** Number of requests in the current window */
  count: number;
  /** Window start timestamp (Unix seconds) */
  windowStart: number;
}

/**
 * Default rate limit rules based on the implementation plan
 */
export const DEFAULT_RATE_LIMIT_RULES: RateLimitRule[] = [
  // Auth endpoints - strict limits to prevent brute force
  {
    method: "POST",
    pattern: "/api/auth/*",
    config: { maxRequests: 10, windowSeconds: 60, keyPrefix: "auth" },
  },
  // Image upload - resource intensive
  {
    method: "POST",
    pattern: "/api/bonsai/*/images",
    config: { maxRequests: 20, windowSeconds: 3600, keyPrefix: "img" },
  },
  // Bonsai creation
  {
    method: "POST",
    pattern: "/api/bonsai",
    config: { maxRequests: 30, windowSeconds: 3600, keyPrefix: "bonsai" },
  },
  // Comments
  {
    method: "POST",
    pattern: "/api/bonsai/*/comments",
    config: { maxRequests: 60, windowSeconds: 3600, keyPrefix: "comment" },
  },
  // Likes - high volume allowed
  {
    method: "POST",
    pattern: "/api/bonsai/*/likes",
    config: { maxRequests: 200, windowSeconds: 3600, keyPrefix: "like" },
  },
  {
    method: "DELETE",
    pattern: "/api/bonsai/*/likes",
    config: { maxRequests: 200, windowSeconds: 3600, keyPrefix: "unlike" },
  },
  // Admin operations - strict limits
  {
    method: "POST",
    pattern: "/api/admin/*",
    config: { maxRequests: 30, windowSeconds: 3600, keyPrefix: "admin" },
  },
  // Default for other mutations
  {
    method: "POST",
    pattern: "/api/*",
    config: { maxRequests: 100, windowSeconds: 3600, keyPrefix: "post" },
  },
  {
    method: "PATCH",
    pattern: "/api/*",
    config: { maxRequests: 100, windowSeconds: 3600, keyPrefix: "patch" },
  },
  {
    method: "DELETE",
    pattern: "/api/*",
    config: { maxRequests: 100, windowSeconds: 3600, keyPrefix: "delete" },
  },
];

/**
 * Check if a path matches a pattern with wildcards
 *
 * Supports * for single path segment and ** for multiple segments
 */
export function matchPath(pattern: string, path: string): boolean {
  // Convert pattern to regex
  const regexPattern = pattern
    .replace(/\*/g, "[^/]+") // * matches single segment
    .replace(/\[^\/\]\+\[^\/\]\+/g, ".*"); // ** matches multiple segments

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

/**
 * Find the matching rate limit rule for a request
 */
export function findMatchingRule(
  method: string,
  path: string,
  rules: RateLimitRule[]
): RateLimitRule | null {
  // Find the most specific matching rule (first match wins)
  for (const rule of rules) {
    if (rule.method !== "*" && rule.method !== method) {
      continue;
    }
    if (matchPath(rule.pattern, path)) {
      return rule;
    }
  }
  return null;
}

/**
 * Generate a rate limit key for KV storage
 *
 * Key format: rate:{prefix}:{identifier}
 * - For authenticated users: rate:{prefix}:user:{userId}
 * - For unauthenticated users: rate:{prefix}:ip:{ipAddress}
 */
export function generateRateLimitKey(
  prefix: string,
  userId: string | null,
  ipAddress: string
): string {
  if (userId) {
    return `rate:${prefix}:user:${userId}`;
  }
  return `rate:${prefix}:ip:${ipAddress}`;
}

/**
 * Get client IP address from Cloudflare headers
 */
export function getClientIp(c: Context): string {
  // CF-Connecting-IP is the most reliable for Cloudflare
  const cfIp = c.req.header("CF-Connecting-IP");
  if (cfIp) {
    return cfIp;
  }

  // Fallback to X-Forwarded-For
  const xff = c.req.header("X-Forwarded-For");
  if (xff) {
    // Take the first IP (client IP)
    return xff.split(",")[0].trim();
  }

  // Last resort: X-Real-IP
  const realIp = c.req.header("X-Real-IP");
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

/**
 * Check and update rate limit state
 *
 * Returns { allowed: true } if request should proceed,
 * or { allowed: false, retryAfter, remaining } if rate limited.
 */
export async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  config: RateLimitConfig
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}> {
  const now = Math.floor(Date.now() / 1000);

  // Get current state from KV
  const stateJson = await kv.get(key);
  let state: RateLimitState;

  if (stateJson) {
    state = JSON.parse(stateJson);

    // Check if we're in a new window
    if (now >= state.windowStart + config.windowSeconds) {
      // Start a new window
      state = { count: 0, windowStart: now };
    }
  } else {
    // No existing state, start fresh
    state = { count: 0, windowStart: now };
  }

  // Check if limit exceeded
  if (state.count >= config.maxRequests) {
    const resetAt = state.windowStart + config.windowSeconds;
    const retryAfter = resetAt - now;
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter: Math.max(1, retryAfter),
    };
  }

  // Increment count and save
  state.count++;
  await kv.put(key, JSON.stringify(state), {
    expirationTtl: config.windowSeconds + 60, // Add buffer for TTL
  });

  return {
    allowed: true,
    remaining: config.maxRequests - state.count,
    resetAt: state.windowStart + config.windowSeconds,
  };
}

/**
 * Rate limiting options
 */
export interface RateLimitOptions {
  /** Custom rules (will be prepended to default rules) */
  rules?: RateLimitRule[];
  /** Whether to use default rules (default: true) */
  useDefaultRules?: boolean;
  /** Custom function to get user ID from context */
  getUserId?: (c: Context) => string | null;
  /** Whether to skip rate limiting for certain paths */
  skip?: (c: Context) => boolean;
}

/**
 * Create rate limiting middleware
 *
 * Usage:
 * ```typescript
 * app.use("*", rateLimiter({
 *   getUserId: (c) => c.get("userId") || null,
 * }));
 * ```
 */
export function rateLimiter(options: RateLimitOptions = {}): MiddlewareHandler {
  const {
    rules = [],
    useDefaultRules = true,
    getUserId = () => null,
    skip,
  } = options;

  // Combine custom rules with default rules
  const allRules = useDefaultRules
    ? [...rules, ...DEFAULT_RATE_LIMIT_RULES]
    : rules;

  return async (c: Context, next: Next) => {
    // Check if rate limiting should be skipped
    if (skip && skip(c)) {
      return next();
    }

    // Get KV binding
    const kv = c.env?.RATE_LIMIT_KV as KVNamespace | undefined;
    if (!kv) {
      // KV not available, skip rate limiting (development fallback)
      console.warn("Rate limiting KV not available, skipping rate limit check");
      return next();
    }

    // Find matching rule
    const method = c.req.method;
    const path = c.req.path;
    const rule = findMatchingRule(method, path, allRules);

    if (!rule) {
      // No matching rule, allow request
      return next();
    }

    // Generate rate limit key
    const userId = getUserId(c);
    const ipAddress = getClientIp(c);
    const key = generateRateLimitKey(
      rule.config.keyPrefix || "default",
      userId,
      ipAddress
    );

    // Check rate limit
    const result = await checkRateLimit(kv, key, rule.config);

    // Add rate limit headers
    c.header("X-RateLimit-Limit", String(rule.config.maxRequests));
    c.header("X-RateLimit-Remaining", String(result.remaining));
    c.header("X-RateLimit-Reset", String(result.resetAt));

    if (!result.allowed) {
      c.header("Retry-After", String(result.retryAfter));
      return c.json(
        {
          error: "Too Many Requests",
          code: "RATE_LIMIT_EXCEEDED",
          message: "Rate limit exceeded. Please try again later.",
          retryAfter: result.retryAfter,
        },
        429
      );
    }

    return next();
  };
}

/**
 * Helper to create a mock KV for testing
 */
export function createMockKV(): KVNamespace {
  const store = new Map<string, { value: string; expiresAt?: number }>();

  return {
    async get(key: string): Promise<string | null> {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() / 1000 > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async put(
      key: string,
      value: string,
      options?: { expirationTtl?: number }
    ): Promise<void> {
      const expiresAt = options?.expirationTtl
        ? Math.floor(Date.now() / 1000) + options.expirationTtl
        : undefined;
      store.set(key, { value, expiresAt });
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
  };
}
