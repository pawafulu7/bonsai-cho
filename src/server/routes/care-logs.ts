/**
 * Care Logs API Routes
 *
 * Handles care log operations for bonsai entries.
 * All operations require authentication and ownership verification.
 */

import { and, desc, eq, lt, or } from "drizzle-orm";
import { Hono } from "hono";

import { generateId } from "@/lib/auth/crypto";
import { parseCsrfCookie, validateCsrfToken } from "@/lib/auth/csrf";
import { parseSessionCookie, validateSession } from "@/lib/auth/session";
import { type Database, getDb } from "@/lib/db/client";
import { decodeCursor, encodeCursor, notDeleted } from "@/lib/db/helpers";
import * as schema from "@/lib/db/schema";

import {
  bonsaiIdParamSchema,
  type CareLogItem,
  type CareLogListResponse,
  careLogIdParamSchema,
  createCareLogSchema,
  paginationQuerySchema,
  updateCareLogSchema,
} from "./bonsai.schema";

// Types
type Bindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  PUBLIC_APP_URL: string;
  SESSION_SECRET: string;
};

type Variables = {
  db: Database;
  userId: string;
};

// Create Hono app for care log routes
const careLogs = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ============================================================================
// Middleware
// ============================================================================

// Database middleware
careLogs.use("*", async (c, next) => {
  const db = await getDb(c.env.TURSO_DATABASE_URL, c.env.TURSO_AUTH_TOKEN);
  c.set("db", db);
  await next();
});

// Auth middleware - require authentication for all care log routes
careLogs.use("*", async (c, next) => {
  const db = c.get("db");
  const cookieHeader = c.req.header("Cookie") || "";
  const sessionToken = parseSessionCookie(cookieHeader);

  if (!sessionToken) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const result = await validateSession(db, sessionToken);
  if (!result) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("userId", result.user.id);
  await next();
});

// CSRF middleware for mutation requests
const csrfMiddleware = async (
  c: Parameters<Parameters<typeof careLogs.use>[1]>[0],
  next: () => Promise<void>
) => {
  const method = c.req.method;
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return next();
  }

  const cookieHeader = c.req.header("Cookie") || "";
  const csrfCookie = parseCsrfCookie(cookieHeader);
  const csrfHeader = c.req.header("X-CSRF-Token") ?? null;

  if (!validateCsrfToken(csrfCookie, csrfHeader)) {
    return c.json({ error: "Invalid CSRF token" }, 403);
  }

  return next();
};

careLogs.use("*", csrfMiddleware);

// ============================================================================
// Helper: Verify bonsai ownership
// ============================================================================

async function verifyBonsaiOwnership(
  db: Database,
  bonsaiId: string,
  userId: string
): Promise<{ owned: boolean }> {
  const [bonsaiRecord] = await db
    .select({ id: schema.bonsai.id })
    .from(schema.bonsai)
    .where(
      and(
        eq(schema.bonsai.id, bonsaiId),
        eq(schema.bonsai.userId, userId),
        notDeleted(schema.bonsai)
      )
    )
    .limit(1);

  return { owned: !!bonsaiRecord };
}

// ============================================================================
// GET /api/bonsai/:bonsaiId/care-logs - List care logs (owner only)
// ============================================================================

careLogs.get("/:bonsaiId/care-logs", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  // Validate bonsai ID
  const paramResult = bonsaiIdParamSchema.safeParse({
    bonsaiId: c.req.param("bonsaiId"),
  });
  if (!paramResult.success) {
    return c.json({ error: "Invalid bonsai ID" }, 400);
  }
  const { bonsaiId } = paramResult.data;

  // Verify ownership (care logs are owner-only)
  const { owned } = await verifyBonsaiOwnership(db, bonsaiId, userId);
  if (!owned) {
    return c.json({ error: "Bonsai not found" }, 404);
  }

  // Parse query parameters
  const queryResult = paginationQuerySchema.safeParse({
    cursor: c.req.query("cursor"),
    limit: c.req.query("limit"),
  });

  if (!queryResult.success) {
    return c.json(
      {
        error: "Invalid query parameters",
        details: queryResult.error.flatten().fieldErrors,
      },
      400
    );
  }

  const { cursor, limit } = queryResult.data;

  // Decode cursor if provided
  let cursorData: { createdAt: string; id: string } | null = null;
  if (cursor) {
    cursorData = decodeCursor(cursor);
    if (!cursorData) {
      return c.json({ error: "Invalid cursor" }, 400);
    }
  }

  try {
    // Cursor condition for pagination
    const cursorCondition = cursorData
      ? or(
          lt(schema.careLogs.createdAt, cursorData.createdAt),
          and(
            eq(schema.careLogs.createdAt, cursorData.createdAt),
            lt(schema.careLogs.id, cursorData.id)
          )
        )
      : undefined;

    // Build conditions
    const conditions = [
      eq(schema.careLogs.bonsaiId, bonsaiId),
      cursorCondition,
    ].filter(Boolean);

    // Query care logs
    const logs = await db
      .select({
        id: schema.careLogs.id,
        bonsaiId: schema.careLogs.bonsaiId,
        careType: schema.careLogs.careType,
        description: schema.careLogs.description,
        performedAt: schema.careLogs.performedAt,
        imageUrl: schema.careLogs.imageUrl,
        createdAt: schema.careLogs.createdAt,
      })
      .from(schema.careLogs)
      .where(and(...conditions))
      .orderBy(desc(schema.careLogs.performedAt), desc(schema.careLogs.id))
      .limit(limit + 1);

    // Determine if there are more results
    const hasMore = logs.length > limit;
    const results = hasMore ? logs.slice(0, limit) : logs;

    // Build response
    const data: CareLogItem[] = results.map((log) => ({
      id: log.id,
      bonsaiId: log.bonsaiId,
      careType: log.careType as CareLogItem["careType"],
      description: log.description,
      performedAt: log.performedAt,
      imageUrl: log.imageUrl,
      createdAt: log.createdAt,
    }));

    // Generate next cursor
    const nextCursor =
      hasMore && results.length > 0
        ? encodeCursor({
            createdAt: results[results.length - 1].createdAt,
            id: results[results.length - 1].id,
          })
        : null;

    const response: CareLogListResponse = {
      data,
      nextCursor,
      hasMore,
    };

    return c.json(response);
  } catch (error) {
    console.error("Error fetching care logs:", error);
    return c.json({ error: "Failed to fetch care logs" }, 500);
  }
});

// ============================================================================
// POST /api/bonsai/:bonsaiId/care-logs - Create care log
// ============================================================================

careLogs.post("/:bonsaiId/care-logs", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  // Validate bonsai ID
  const paramResult = bonsaiIdParamSchema.safeParse({
    bonsaiId: c.req.param("bonsaiId"),
  });
  if (!paramResult.success) {
    return c.json({ error: "Invalid bonsai ID" }, 400);
  }
  const { bonsaiId } = paramResult.data;

  // Verify ownership (IDOR prevention)
  const { owned } = await verifyBonsaiOwnership(db, bonsaiId, userId);
  if (!owned) {
    return c.json({ error: "Bonsai not found" }, 404);
  }

  try {
    const body = await c.req.json();
    const parseResult = createCareLogSchema.safeParse(body);

    if (!parseResult.success) {
      return c.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten().fieldErrors,
        },
        400
      );
    }

    const data = parseResult.data;
    const now = new Date().toISOString();
    const logId = generateId();

    await db.insert(schema.careLogs).values({
      id: logId,
      bonsaiId,
      careType: data.careType,
      description: data.description ?? null,
      performedAt: data.performedAt,
      imageUrl: data.imageUrl ?? null,
      createdAt: now,
    });

    return c.json(
      {
        id: logId,
        message: "Care log created successfully",
      },
      201
    );
  } catch (error) {
    console.error("Error creating care log:", error);
    return c.json({ error: "Failed to create care log" }, 500);
  }
});

// ============================================================================
// PATCH /api/bonsai/:bonsaiId/care-logs/:logId - Update care log
// ============================================================================

careLogs.patch("/:bonsaiId/care-logs/:logId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  // Validate parameters
  const paramResult = careLogIdParamSchema.safeParse({
    bonsaiId: c.req.param("bonsaiId"),
    logId: c.req.param("logId"),
  });
  if (!paramResult.success) {
    return c.json({ error: "Invalid parameters" }, 400);
  }
  const { bonsaiId, logId } = paramResult.data;

  try {
    // Verify ownership with double check (IDOR prevention)
    // Check that: 1) bonsai belongs to user, 2) care log belongs to bonsai
    const [careLogRecord] = await db
      .select({
        id: schema.careLogs.id,
      })
      .from(schema.careLogs)
      .innerJoin(schema.bonsai, eq(schema.careLogs.bonsaiId, schema.bonsai.id))
      .where(
        and(
          eq(schema.careLogs.id, logId),
          eq(schema.careLogs.bonsaiId, bonsaiId),
          eq(schema.bonsai.userId, userId),
          notDeleted(schema.bonsai)
        )
      )
      .limit(1);

    if (!careLogRecord) {
      return c.json({ error: "Care log not found" }, 404);
    }

    const body = await c.req.json();
    const parseResult = updateCareLogSchema.safeParse(body);

    if (!parseResult.success) {
      return c.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten().fieldErrors,
        },
        400
      );
    }

    const data = parseResult.data;

    await db
      .update(schema.careLogs)
      .set(data)
      .where(eq(schema.careLogs.id, logId));

    return c.json({ message: "Care log updated successfully" });
  } catch (error) {
    console.error("Error updating care log:", error);
    return c.json({ error: "Failed to update care log" }, 500);
  }
});

// ============================================================================
// DELETE /api/bonsai/:bonsaiId/care-logs/:logId - Delete care log
// ============================================================================

careLogs.delete("/:bonsaiId/care-logs/:logId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  // Validate parameters
  const paramResult = careLogIdParamSchema.safeParse({
    bonsaiId: c.req.param("bonsaiId"),
    logId: c.req.param("logId"),
  });
  if (!paramResult.success) {
    return c.json({ error: "Invalid parameters" }, 400);
  }
  const { bonsaiId, logId } = paramResult.data;

  try {
    // Verify ownership with double check (IDOR prevention)
    const [careLogRecord] = await db
      .select({
        id: schema.careLogs.id,
      })
      .from(schema.careLogs)
      .innerJoin(schema.bonsai, eq(schema.careLogs.bonsaiId, schema.bonsai.id))
      .where(
        and(
          eq(schema.careLogs.id, logId),
          eq(schema.careLogs.bonsaiId, bonsaiId),
          eq(schema.bonsai.userId, userId),
          notDeleted(schema.bonsai)
        )
      )
      .limit(1);

    if (!careLogRecord) {
      return c.json({ error: "Care log not found" }, 404);
    }

    // Hard delete (care logs don't have soft delete in current schema)
    await db.delete(schema.careLogs).where(eq(schema.careLogs.id, logId));

    return c.json({ message: "Care log deleted successfully" });
  } catch (error) {
    console.error("Error deleting care log:", error);
    return c.json({ error: "Failed to delete care log" }, 500);
  }
});

export default careLogs;
