/**
 * Admin Statistics API Routes
 *
 * GET /api/admin/stats - Get dashboard statistics
 * GET /api/admin/activity - Get recent activity
 */

import { Hono } from "hono";
import { z } from "zod";

import { validateAdminAuth } from "@/lib/auth/admin";
import { type Database, getDb } from "@/lib/db/client";
import { getAdminStats, getRecentActivity } from "@/lib/db/queries/admin-stats";

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

const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

// ============================================================================
// Hono App
// ============================================================================

const adminStats = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ============================================================================
// Middleware
// ============================================================================

// Database middleware
adminStats.use("*", async (c, next) => {
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
adminStats.use("*", async (c, next) => {
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

// ============================================================================
// GET /api/admin/stats - Get dashboard statistics
// ============================================================================

adminStats.get("/stats", async (c) => {
  const db = c.get("db");

  try {
    const stats = await getAdminStats(db);

    return c.json({
      success: true,
      data: stats,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return c.json(
      { error: "Failed to fetch statistics", code: "INTERNAL_ERROR" },
      500
    );
  }
});

// ============================================================================
// GET /api/admin/activity - Get recent activity
// ============================================================================

adminStats.get("/activity", async (c) => {
  const db = c.get("db");

  // Validate query parameters
  const queryResult = activityQuerySchema.safeParse({
    limit: c.req.query("limit"),
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

  const { limit } = queryResult.data;

  try {
    const activity = await getRecentActivity(db, limit);

    return c.json({
      success: true,
      data: activity,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    return c.json(
      { error: "Failed to fetch activity", code: "INTERNAL_ERROR" },
      500
    );
  }
});

export default adminStats;
