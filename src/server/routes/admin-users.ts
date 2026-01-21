/**
 * Admin User Management API Routes
 *
 * GET /api/admin/users - Get paginated list of users
 * GET /api/admin/users/:id - Get user details
 */

import { Hono } from "hono";
import { z } from "zod";

import { validateAdminAuth } from "@/lib/auth/admin";
import { type Database, getDb } from "@/lib/db/client";
import {
  getAdminUserDetail,
  getAdminUserList,
  type UserStatus,
} from "@/lib/db/queries/admin-users";

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

const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().max(100).optional(),
  status: z.enum(["active", "suspended", "banned"]).optional(),
  sortBy: z
    .enum(["createdAt", "name", "bonsaiCount"])
    .optional()
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

const userIdParamSchema = z.object({
  id: z.string().min(1, "User ID is required"),
});

// ============================================================================
// Hono App
// ============================================================================

const adminUsers = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ============================================================================
// Middleware
// ============================================================================

// Database middleware
adminUsers.use("*", async (c, next) => {
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
adminUsers.use("*", async (c, next) => {
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
// GET /api/admin/users - Get paginated list of users
// ============================================================================

adminUsers.get("/", async (c) => {
  const db = c.get("db");

  // Validate query parameters
  const queryResult = userListQuerySchema.safeParse({
    page: c.req.query("page"),
    limit: c.req.query("limit"),
    search: c.req.query("search"),
    status: c.req.query("status"),
    sortBy: c.req.query("sortBy"),
    sortOrder: c.req.query("sortOrder"),
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

  const { page, limit, search, status, sortBy, sortOrder } = queryResult.data;

  try {
    const result = await getAdminUserList(db, {
      page,
      limit,
      search,
      status: status as UserStatus | undefined,
      sortBy,
      sortOrder,
    });

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error fetching user list:", error);
    return c.json(
      { error: "Failed to fetch users", code: "INTERNAL_ERROR" },
      500
    );
  }
});

// ============================================================================
// GET /api/admin/users/:id - Get user details
// ============================================================================

adminUsers.get("/:id", async (c) => {
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

  const { id } = paramResult.data;

  try {
    const user = await getAdminUserDetail(db, id);

    if (!user) {
      return c.json({ error: "User not found", code: "USER_NOT_FOUND" }, 404);
    }

    return c.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Error fetching user details:", error);
    return c.json(
      { error: "Failed to fetch user", code: "INTERNAL_ERROR" },
      500
    );
  }
});

export default adminUsers;
