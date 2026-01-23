/**
 * Admin Authentication API Routes
 *
 * POST /api/admin/auth/login - Admin login with email/password
 * POST /api/admin/auth/logout - Admin logout
 * GET /api/admin/auth/me - Get current admin user info
 */

import { Hono } from "hono";
import { z } from "zod";

import {
  authenticateAdmin,
  clearAdminSessionCookie,
  createAdminSession,
  createAdminSessionCookie,
  invalidateAdminSession,
  parseAdminSessionCookie,
  validateAdminSession,
} from "@/lib/auth/admin-session";
import { type Database, getDb } from "@/lib/db/client";
import { getClientIp } from "../middleware/rate-limit";

// ============================================================================
// Types
// ============================================================================

type Bindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
};

type Variables = {
  db: Database;
};

// ============================================================================
// Validation Schemas
// ============================================================================

const loginSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});

// ============================================================================
// Hono App
// ============================================================================

const adminAuth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ============================================================================
// Middleware
// ============================================================================

// Database middleware
adminAuth.use("*", async (c, next) => {
  try {
    const db = await getDb(c.env.TURSO_DATABASE_URL, c.env.TURSO_AUTH_TOKEN);
    c.set("db", db);
    await next();
  } catch (error) {
    console.error("Database connection error:", error);
    return c.json(
      { error: "Database connection failed", code: "INTERNAL_ERROR" },
      500
    );
  }
});

// ============================================================================
// POST /api/admin/auth/login - Admin login
// ============================================================================

adminAuth.post("/login", async (c) => {
  const db = c.get("db");

  // Parse request body
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body", code: "INVALID_JSON" }, 400);
  }

  // Validate request body
  const parseResult = loginSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: z.treeifyError(parseResult.error),
      },
      400
    );
  }

  const { email, password } = parseResult.data;
  const ipAddress = getClientIp(c);

  try {
    // Authenticate admin
    const authResult = await authenticateAdmin(db, email, password, ipAddress);

    if (!authResult.success) {
      // Return appropriate error message
      switch (authResult.error) {
        case "INVALID_CREDENTIALS":
          return c.json(
            {
              error: "メールアドレスまたはパスワードが正しくありません",
              code: "INVALID_CREDENTIALS",
            },
            401
          );
        case "ACCOUNT_LOCKED":
          return c.json(
            {
              error: `アカウントがロックされています。${authResult.lockoutRemaining}分後に再試行してください`,
              code: "ACCOUNT_LOCKED",
              lockoutRemaining: authResult.lockoutRemaining,
            },
            403
          );
        case "ACCOUNT_DISABLED":
          return c.json(
            {
              error: "このアカウントは無効化されています",
              code: "ACCOUNT_DISABLED",
            },
            403
          );
        default:
          return c.json(
            { error: "認証に失敗しました", code: "AUTH_FAILED" },
            500
          );
      }
    }

    // Check if 2FA is enabled (future implementation)
    if (authResult.user!.totpEnabled) {
      // For now, return that 2FA is required
      // In future: return a temporary token for 2FA verification
      return c.json(
        {
          error: "2FA verification required",
          code: "TOTP_REQUIRED",
          userId: authResult.user!.id,
        },
        403
      );
    }

    // Create session
    const userAgent = c.req.header("User-Agent");
    const { token } = await createAdminSession(
      db,
      authResult.user!.id,
      ipAddress,
      userAgent
    );

    // Set session cookie
    c.header("Set-Cookie", createAdminSessionCookie(token));

    return c.json({
      success: true,
      user: {
        id: authResult.user!.id,
        email: authResult.user!.email,
        name: authResult.user!.name,
      },
    });
  } catch (error) {
    console.error("Error during admin login:", error);
    return c.json({ error: "Login failed", code: "INTERNAL_ERROR" }, 500);
  }
});

// ============================================================================
// POST /api/admin/auth/logout - Admin logout
// ============================================================================

adminAuth.post("/logout", async (c) => {
  const db = c.get("db");
  const cookieHeader = c.req.header("Cookie");
  const sessionToken = parseAdminSessionCookie(cookieHeader);

  if (sessionToken) {
    try {
      await invalidateAdminSession(db, sessionToken);
    } catch (error) {
      console.error("Error invalidating admin session:", error);
      // Continue with logout even if session invalidation fails
    }
  }

  // Clear session cookie
  c.header("Set-Cookie", clearAdminSessionCookie());

  return c.json({ success: true });
});

// ============================================================================
// GET /api/admin/auth/me - Get current admin user info
// ============================================================================

adminAuth.get("/me", async (c) => {
  const db = c.get("db");
  const cookieHeader = c.req.header("Cookie");
  const sessionToken = parseAdminSessionCookie(cookieHeader);

  if (!sessionToken) {
    return c.json({ error: "Not authenticated", code: "UNAUTHORIZED" }, 401);
  }

  try {
    const result = await validateAdminSession(db, sessionToken);

    if (!result) {
      return c.json(
        { error: "Session expired or invalid", code: "UNAUTHORIZED" },
        401
      );
    }

    return c.json({
      success: true,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
    });
  } catch (error) {
    console.error("Error validating admin session:", error);
    return c.json(
      { error: "Failed to validate session", code: "INTERNAL_ERROR" },
      500
    );
  }
});

export default adminAuth;
