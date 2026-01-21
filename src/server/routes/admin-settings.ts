/**
 * Admin Settings API Routes
 *
 * GET /api/admin/settings - Get all settings
 * PUT /api/admin/settings/:key - Update a setting
 * GET /api/admin/audit-logs - Get audit logs
 */

import { Hono } from "hono";
import { z } from "zod";

import { validateAdminAuth, validateAdminCsrf } from "@/lib/auth/admin";
import { type Database, getDb } from "@/lib/db/client";
import {
  DEFAULT_SETTINGS,
  getAllSettings,
  getAuditLogs,
  updateSetting,
} from "@/lib/db/queries/admin-settings";
import { getClientIp } from "../middleware/rate-limit";

// ============================================================================
// Types
// ============================================================================

type Bindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  PUBLIC_APP_URL: string;
  SESSION_SECRET: string;
  ADMIN_USER_IDS?: string;
};

type Variables = {
  db: Database;
  userId: string;
  isAdmin: boolean;
};

// ============================================================================
// Validation Schemas
// ============================================================================

const settingKeySchema = z.object({
  key: z.string().refine((key) => key in DEFAULT_SETTINGS, {
    message: "Invalid setting key",
  }),
});

const updateSettingSchema = z.object({
  value: z.string().max(1000, "Value must be 1000 characters or less"),
});

const auditLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

// ============================================================================
// Hono App
// ============================================================================

const adminSettings = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ============================================================================
// Middleware
// ============================================================================

// Database middleware
adminSettings.use("*", async (c, next) => {
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

// Authentication middleware - requires admin privileges
adminSettings.use("*", async (c, next) => {
  const db = c.get("db");
  const cookieHeader = c.req.header("Cookie");

  const authResult = await validateAdminAuth(
    db,
    cookieHeader,
    c.env.ADMIN_USER_IDS
  );

  if (!authResult.success) {
    return c.json(
      {
        error: authResult.error,
        code: authResult.code,
        ...(authResult.code === "FORBIDDEN" && {
          message: "Admin privileges required",
        }),
      },
      authResult.status
    );
  }

  c.set("userId", authResult.userId);
  c.set("isAdmin", true);
  await next();
});

// CSRF middleware for mutation requests
adminSettings.use("*", async (c, next) => {
  const method = c.req.method;
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return next();
  }

  const cookieHeader = c.req.header("Cookie");
  const csrfHeader = c.req.header("X-CSRF-Token");

  const csrfError = validateAdminCsrf(cookieHeader, csrfHeader);
  if (csrfError) {
    return c.json(csrfError, 403);
  }

  return next();
});

// ============================================================================
// GET /api/admin/settings - Get all settings
// ============================================================================

adminSettings.get("/", async (c) => {
  const db = c.get("db");

  try {
    const settings = await getAllSettings(db);

    return c.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return c.json(
      { error: "Failed to fetch settings", code: "INTERNAL_ERROR" },
      500
    );
  }
});

// ============================================================================
// PUT /api/admin/settings/:key - Update a setting
// ============================================================================

adminSettings.put("/:key", async (c) => {
  const db = c.get("db");
  const adminUserId = c.get("userId");

  // Validate setting key
  const keyResult = settingKeySchema.safeParse({
    key: c.req.param("key"),
  });

  if (!keyResult.success) {
    return c.json(
      {
        error: "Invalid setting key",
        code: "VALIDATION_ERROR",
        details: z.treeifyError(keyResult.error),
      },
      400
    );
  }

  const { key } = keyResult.data;

  // Parse request body
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body", code: "INVALID_JSON" }, 400);
  }

  const bodyResult = updateSettingSchema.safeParse(body);
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

  const { value } = bodyResult.data;
  const ipAddress = getClientIp(c);

  try {
    const result = await updateSetting(db, key, value, adminUserId, ipAddress);

    return c.json({
      success: true,
      key,
      previousValue: result.previousValue,
      newValue: value,
      message: `Setting "${key}" has been updated`,
    });
  } catch (error) {
    console.error("Error updating setting:", error);
    return c.json(
      { error: "Failed to update setting", code: "INTERNAL_ERROR" },
      500
    );
  }
});

// ============================================================================
// GET /api/admin/audit-logs - Get audit logs
// ============================================================================

adminSettings.get("/audit-logs", async (c) => {
  const db = c.get("db");

  // Validate query parameters
  const queryResult = auditLogQuerySchema.safeParse({
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
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

  const { limit, offset } = queryResult.data;

  try {
    const result = await getAuditLogs(db, { limit, offset });

    return c.json({
      success: true,
      data: result.logs,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return c.json(
      { error: "Failed to fetch audit logs", code: "INTERNAL_ERROR" },
      500
    );
  }
});

export default adminSettings;
