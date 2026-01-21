/**
 * Admin API Routes
 *
 * Administrative endpoints for user moderation.
 * POST /api/admin/users/:id/ban - Ban a user
 * POST /api/admin/users/:id/suspend - Suspend a user
 * POST /api/admin/users/:id/unban - Unban/unsuspend a user
 * GET /api/admin/users/:id/history - Get user status history
 */

import { and, eq, inArray, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { parseCsrfCookie, validateCsrfToken } from "@/lib/auth/csrf";
import {
  banUser,
  getUserStatusHistory,
  parseSessionCookie,
  suspendUser,
  unbanUser,
  validateSession,
} from "@/lib/auth/session";
import { type Database, getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { getClientIp } from "../middleware/rate-limit";

// ============================================================================
// Configuration
// ============================================================================

/**
 * Temporary admin user IDs (hardcoded for Phase 1)
 * TODO: Replace with proper role-based access control in Phase 2
 */
const ADMIN_USER_IDS: string[] = [
  // Add admin user IDs here when needed
  // Example: "user_abc123xyz"
];

// ============================================================================
// Validation Schemas
// ============================================================================

const userIdParamSchema = z.object({
  id: z.string().min(1, "User ID is required"),
});

const moderationActionSchema = z.object({
  reason: z
    .string()
    .max(500, "Reason must be 500 characters or less")
    .optional(),
});

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

// ============================================================================
// Types
// ============================================================================

type Bindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  PUBLIC_APP_URL: string;
  SESSION_SECRET: string;
};

type Variables = {
  db: Database;
  userId: string;
  isAdmin: boolean;
};

// ============================================================================
// Response Types
// ============================================================================

interface ModerationActionResponse {
  success: boolean;
  userId: string;
  previousStatus: string;
  newStatus: string;
  message: string;
}

interface StatusHistoryEntry {
  id: string;
  previousStatus: string;
  newStatus: string;
  reason: string | null;
  changedBy: string | null;
  changedByName: string | null;
  changedAt: string;
}

interface StatusHistoryResponse {
  userId: string;
  currentStatus: string;
  history: StatusHistoryEntry[];
  nextCursor: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a user ID is an admin
 */
function isAdminUser(userId: string): boolean {
  return ADMIN_USER_IDS.includes(userId);
}

// ============================================================================
// Hono App
// ============================================================================

const admin = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ============================================================================
// Middleware
// ============================================================================

// Database middleware
admin.use("*", async (c, next) => {
  const db = await getDb(c.env.TURSO_DATABASE_URL, c.env.TURSO_AUTH_TOKEN);
  c.set("db", db);
  await next();
});

// Authentication middleware - requires admin privileges
admin.use("*", async (c, next) => {
  const db = c.get("db");
  const cookieHeader = c.req.header("Cookie") || "";
  const sessionToken = parseSessionCookie(cookieHeader);

  if (!sessionToken) {
    return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  }

  const result = await validateSession(db, sessionToken);
  if (!result) {
    return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  }

  // Check admin privileges
  if (!isAdminUser(result.user.id)) {
    return c.json(
      {
        error: "Forbidden",
        code: "FORBIDDEN",
        message: "Admin privileges required",
      },
      403
    );
  }

  c.set("userId", result.user.id);
  c.set("isAdmin", true);
  await next();
});

// CSRF middleware for mutation requests
admin.use("*", async (c, next) => {
  const method = c.req.method;
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return next();
  }

  const cookieHeader = c.req.header("Cookie") || "";
  const csrfCookie = parseCsrfCookie(cookieHeader);
  const csrfHeader = c.req.header("X-CSRF-Token") ?? null;

  if (!validateCsrfToken(csrfCookie, csrfHeader)) {
    return c.json(
      { error: "Invalid CSRF token", code: "CSRF_VALIDATION_FAILED" },
      403
    );
  }

  return next();
});

// ============================================================================
// POST /api/admin/users/:id/ban - Ban a user
// ============================================================================

admin.post("/users/:id/ban", async (c) => {
  const db = c.get("db");
  const adminUserId = c.get("userId");

  // Validate user ID parameter
  const paramResult = userIdParamSchema.safeParse({
    id: c.req.param("id"),
  });

  if (!paramResult.success) {
    return c.json(
      {
        error: "Invalid user ID",
        code: "VALIDATION_ERROR",
        details: z.treeifyError(paramResult.error),
      },
      400
    );
  }

  const targetUserId = paramResult.data.id;

  // Prevent self-ban
  if (targetUserId === adminUserId) {
    return c.json(
      {
        error: "Cannot ban yourself",
        code: "SELF_ACTION_FORBIDDEN",
      },
      400
    );
  }

  // Prevent banning other admins
  if (isAdminUser(targetUserId)) {
    return c.json(
      {
        error: "Cannot ban another admin",
        code: "ADMIN_PROTECTED",
      },
      403
    );
  }

  // Parse request body
  let body: unknown = {};
  try {
    const text = await c.req.text();
    if (text) {
      body = JSON.parse(text);
    }
  } catch {
    return c.json({ error: "Invalid JSON body", code: "INVALID_JSON" }, 400);
  }

  const bodyResult = moderationActionSchema.safeParse(body);
  if (!bodyResult.success) {
    return c.json(
      {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: z.treeifyError(bodyResult.error),
      },
      400
    );
  }

  const { reason } = bodyResult.data;
  const ipAddress = getClientIp(c);

  try {
    // Check if target user exists
    const [targetUser] = await db
      .select({ id: schema.users.id, status: schema.users.status })
      .from(schema.users)
      .where(eq(schema.users.id, targetUserId))
      .limit(1);

    if (!targetUser) {
      return c.json({ error: "User not found", code: "USER_NOT_FOUND" }, 404);
    }

    // Check if user is already banned
    if (targetUser.status === "banned") {
      return c.json(
        {
          error: "User is already banned",
          code: "ALREADY_BANNED",
        },
        400
      );
    }

    // Ban the user
    const result = await banUser(
      db,
      targetUserId,
      reason,
      adminUserId,
      ipAddress
    );

    if (!result.success) {
      return c.json({ error: "Failed to ban user", code: "BAN_FAILED" }, 500);
    }

    const response: ModerationActionResponse = {
      success: true,
      userId: targetUserId,
      previousStatus: result.previousStatus,
      newStatus: "banned",
      message: `User has been banned${reason ? `: ${reason}` : ""}`,
    };

    return c.json(response, 200);
  } catch (error) {
    console.error("Error banning user:", error);
    return c.json({ error: "Failed to ban user", code: "INTERNAL_ERROR" }, 500);
  }
});

// ============================================================================
// POST /api/admin/users/:id/suspend - Suspend a user
// ============================================================================

admin.post("/users/:id/suspend", async (c) => {
  const db = c.get("db");
  const adminUserId = c.get("userId");

  // Validate user ID parameter
  const paramResult = userIdParamSchema.safeParse({
    id: c.req.param("id"),
  });

  if (!paramResult.success) {
    return c.json(
      {
        error: "Invalid user ID",
        code: "VALIDATION_ERROR",
        details: z.treeifyError(paramResult.error),
      },
      400
    );
  }

  const targetUserId = paramResult.data.id;

  // Prevent self-suspend
  if (targetUserId === adminUserId) {
    return c.json(
      {
        error: "Cannot suspend yourself",
        code: "SELF_ACTION_FORBIDDEN",
      },
      400
    );
  }

  // Prevent suspending other admins
  if (isAdminUser(targetUserId)) {
    return c.json(
      {
        error: "Cannot suspend another admin",
        code: "ADMIN_PROTECTED",
      },
      403
    );
  }

  // Parse request body
  let body: unknown = {};
  try {
    const text = await c.req.text();
    if (text) {
      body = JSON.parse(text);
    }
  } catch {
    return c.json({ error: "Invalid JSON body", code: "INVALID_JSON" }, 400);
  }

  const bodyResult = moderationActionSchema.safeParse(body);
  if (!bodyResult.success) {
    return c.json(
      {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: z.treeifyError(bodyResult.error),
      },
      400
    );
  }

  const { reason } = bodyResult.data;
  const ipAddress = getClientIp(c);

  try {
    // Check if target user exists
    const [targetUser] = await db
      .select({ id: schema.users.id, status: schema.users.status })
      .from(schema.users)
      .where(eq(schema.users.id, targetUserId))
      .limit(1);

    if (!targetUser) {
      return c.json({ error: "User not found", code: "USER_NOT_FOUND" }, 404);
    }

    // Check if user is already suspended
    if (targetUser.status === "suspended") {
      return c.json(
        {
          error: "User is already suspended",
          code: "ALREADY_SUSPENDED",
        },
        400
      );
    }

    // Suspend the user
    const result = await suspendUser(
      db,
      targetUserId,
      reason,
      adminUserId,
      ipAddress
    );

    if (!result.success) {
      return c.json(
        { error: "Failed to suspend user", code: "SUSPEND_FAILED" },
        500
      );
    }

    const response: ModerationActionResponse = {
      success: true,
      userId: targetUserId,
      previousStatus: result.previousStatus,
      newStatus: "suspended",
      message: `User has been suspended${reason ? `: ${reason}` : ""}`,
    };

    return c.json(response, 200);
  } catch (error) {
    console.error("Error suspending user:", error);
    return c.json(
      { error: "Failed to suspend user", code: "INTERNAL_ERROR" },
      500
    );
  }
});

// ============================================================================
// POST /api/admin/users/:id/unban - Unban/unsuspend a user
// ============================================================================

admin.post("/users/:id/unban", async (c) => {
  const db = c.get("db");
  const adminUserId = c.get("userId");

  // Validate user ID parameter
  const paramResult = userIdParamSchema.safeParse({
    id: c.req.param("id"),
  });

  if (!paramResult.success) {
    return c.json(
      {
        error: "Invalid user ID",
        code: "VALIDATION_ERROR",
        details: z.treeifyError(paramResult.error),
      },
      400
    );
  }

  const targetUserId = paramResult.data.id;

  // Parse request body
  let body: unknown = {};
  try {
    const text = await c.req.text();
    if (text) {
      body = JSON.parse(text);
    }
  } catch {
    return c.json({ error: "Invalid JSON body", code: "INVALID_JSON" }, 400);
  }

  const bodyResult = moderationActionSchema.safeParse(body);
  if (!bodyResult.success) {
    return c.json(
      {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: z.treeifyError(bodyResult.error),
      },
      400
    );
  }

  const { reason } = bodyResult.data;
  const ipAddress = getClientIp(c);

  try {
    // Check if target user exists
    const [targetUser] = await db
      .select({ id: schema.users.id, status: schema.users.status })
      .from(schema.users)
      .where(eq(schema.users.id, targetUserId))
      .limit(1);

    if (!targetUser) {
      return c.json({ error: "User not found", code: "USER_NOT_FOUND" }, 404);
    }

    // Check if user is already active
    if (targetUser.status === "active") {
      return c.json(
        {
          error: "User is already active",
          code: "ALREADY_ACTIVE",
        },
        400
      );
    }

    // Unban the user
    const result = await unbanUser(
      db,
      targetUserId,
      reason,
      adminUserId,
      ipAddress
    );

    if (!result.success) {
      return c.json(
        { error: "Failed to unban user", code: "UNBAN_FAILED" },
        500
      );
    }

    const response: ModerationActionResponse = {
      success: true,
      userId: targetUserId,
      previousStatus: result.previousStatus,
      newStatus: "active",
      message: `User has been unbanned${reason ? `: ${reason}` : ""}`,
    };

    return c.json(response, 200);
  } catch (error) {
    console.error("Error unbanning user:", error);
    return c.json(
      { error: "Failed to unban user", code: "INTERNAL_ERROR" },
      500
    );
  }
});

// ============================================================================
// GET /api/admin/users/:id/history - Get user status history
// ============================================================================

admin.get("/users/:id/history", async (c) => {
  const db = c.get("db");

  // Validate user ID parameter
  const paramResult = userIdParamSchema.safeParse({
    id: c.req.param("id"),
  });

  if (!paramResult.success) {
    return c.json(
      {
        error: "Invalid user ID",
        code: "VALIDATION_ERROR",
        details: z.treeifyError(paramResult.error),
      },
      400
    );
  }

  // Validate query parameters
  const queryResult = historyQuerySchema.safeParse({
    limit: c.req.query("limit"),
    cursor: c.req.query("cursor"),
  });

  if (!queryResult.success) {
    return c.json(
      {
        error: "Invalid query parameters",
        code: "VALIDATION_ERROR",
        details: z.treeifyError(queryResult.error),
      },
      400
    );
  }

  const targetUserId = paramResult.data.id;
  const { limit, cursor } = queryResult.data;

  try {
    // Get user's current status
    const [targetUser] = await db
      .select({ id: schema.users.id, status: schema.users.status })
      .from(schema.users)
      .where(eq(schema.users.id, targetUserId))
      .limit(1);

    if (!targetUser) {
      return c.json({ error: "User not found", code: "USER_NOT_FOUND" }, 404);
    }

    // Get status history with pagination
    const historyResult = await getUserStatusHistory(db, targetUserId, {
      limit,
      cursor,
    });

    // Enrich history with admin names (batch query for efficiency)
    const adminIds = [
      ...new Set(
        historyResult.items.filter((h) => h.changedBy).map((h) => h.changedBy!)
      ),
    ];
    const adminNames = new Map<string, string>();

    if (adminIds.length > 0) {
      const admins = await db
        .select({ id: schema.users.id, name: schema.users.name })
        .from(schema.users)
        .where(
          and(
            inArray(schema.users.id, adminIds),
            isNull(schema.users.deletedAt)
          )
        );

      for (const admin of admins) {
        adminNames.set(admin.id, admin.name);
      }
    }

    const enrichedHistory: StatusHistoryEntry[] = historyResult.items.map(
      (entry) => ({
        id: entry.id,
        previousStatus: entry.previousStatus,
        newStatus: entry.newStatus,
        reason: entry.reason,
        changedBy: entry.changedBy,
        changedByName: entry.changedBy
          ? adminNames.get(entry.changedBy) || null
          : null,
        changedAt: entry.changedAt,
      })
    );

    const response: StatusHistoryResponse = {
      userId: targetUserId,
      currentStatus: targetUser.status as string,
      history: enrichedHistory,
      nextCursor: historyResult.nextCursor,
    };

    return c.json(response, 200);
  } catch (error) {
    console.error("Error fetching user status history:", error);
    return c.json(
      { error: "Failed to fetch status history", code: "INTERNAL_ERROR" },
      500
    );
  }
});

export default admin;
