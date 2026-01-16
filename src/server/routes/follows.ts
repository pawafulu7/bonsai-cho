/**
 * Follows API Routes
 *
 * Handles user follow/unfollow functionality.
 * Implements idempotent operations and counter updates.
 */

import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { Hono } from "hono";

import { generateId } from "@/lib/auth/crypto";
import { parseCsrfCookie, validateCsrfToken } from "@/lib/auth/csrf";
import { parseSessionCookie, validateSession } from "@/lib/auth/session";
import { type Database, getDb } from "@/lib/db/client";
import { decodeCursor, encodeCursor } from "@/lib/db/helpers";
import * as schema from "@/lib/db/schema";

import {
  type FollowListResponse,
  type FollowResponse,
  paginationQuerySchema,
  type UserSummary,
  userIdParamSchema,
} from "./social.schema";

// Types
type Bindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  PUBLIC_APP_URL: string;
  SESSION_SECRET: string;
};

type Variables = {
  db: Database;
  userId: string | null;
};

// Create Hono app for follows routes
const follows = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ============================================================================
// Middleware
// ============================================================================

// Database middleware
follows.use("*", async (c, next) => {
  const db = await getDb(c.env.TURSO_DATABASE_URL, c.env.TURSO_AUTH_TOKEN);
  c.set("db", db);
  await next();
});

// Optional auth middleware - sets userId if authenticated, null otherwise
follows.use("*", async (c, next) => {
  const db = c.get("db");
  const cookieHeader = c.req.header("Cookie") || "";
  const sessionToken = parseSessionCookie(cookieHeader);

  if (sessionToken) {
    const result = await validateSession(db, sessionToken);
    if (result) {
      c.set("userId", result.user.id);
      await next();
      return;
    }
  }

  c.set("userId", null);
  await next();
});

// CSRF middleware for mutation requests
const csrfMiddleware = async (
  c: Parameters<Parameters<typeof follows.use>[1]>[0],
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

follows.use("*", csrfMiddleware);

// Helper function to require authentication
function requireAuth(userId: string | null): userId is string {
  return userId !== null;
}

// ============================================================================
// Helper: Verify target user exists and is not deleted
// ============================================================================

async function verifyUserExists(
  db: Database,
  userId: string
): Promise<{ id: string } | null> {
  const [user] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.id, userId), isNull(schema.users.deletedAt)))
    .limit(1);

  return user ?? null;
}

// ============================================================================
// Helper: Update follower/following counts
// ============================================================================

async function updateFollowerCount(
  db: Database,
  userId: string
): Promise<number> {
  // Use subquery to get accurate count
  // Exclude deleted followers for consistency with list display
  const [result] = await db
    .update(schema.users)
    .set({
      followerCount: sql`(SELECT COUNT(*) FROM ${schema.follows} INNER JOIN ${schema.users} AS follower ON ${schema.follows.followerId} = follower.id WHERE ${schema.follows.followingId} = ${userId} AND follower.deleted_at IS NULL)`,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.users.id, userId))
    .returning({ followerCount: schema.users.followerCount });

  return result?.followerCount ?? 0;
}

async function updateFollowingCount(
  db: Database,
  userId: string
): Promise<number> {
  // Use subquery to get accurate count
  // Exclude deleted following users for consistency with list display
  const [result] = await db
    .update(schema.users)
    .set({
      followingCount: sql`(SELECT COUNT(*) FROM ${schema.follows} INNER JOIN ${schema.users} AS following ON ${schema.follows.followingId} = following.id WHERE ${schema.follows.followerId} = ${userId} AND following.deleted_at IS NULL)`,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.users.id, userId))
    .returning({ followingCount: schema.users.followingCount });

  return result?.followingCount ?? 0;
}

// ============================================================================
// POST /api/users/:userId/follow - Follow user
// ============================================================================

follows.post("/:userId/follow", async (c) => {
  const db = c.get("db");
  const currentUserId = c.get("userId");

  // Require authentication
  if (!requireAuth(currentUserId)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Validate userId
  const paramResult = userIdParamSchema.safeParse({
    userId: c.req.param("userId"),
  });

  if (!paramResult.success) {
    return c.json(
      {
        error: "Invalid user ID",
        details: paramResult.error.flatten().fieldErrors,
      },
      400
    );
  }

  const { userId: targetUserId } = paramResult.data;

  // Prevent self-follow
  if (currentUserId === targetUserId) {
    return c.json({ error: "Cannot follow yourself" }, 400);
  }

  // Verify target user exists
  const targetUser = await verifyUserExists(db, targetUserId);
  if (!targetUser) {
    return c.json({ error: "User not found" }, 404);
  }

  try {
    // Insert follow (idempotent - ignore if already exists)
    await db
      .insert(schema.follows)
      .values({
        id: generateId(),
        followerId: currentUserId,
        followingId: targetUserId,
        createdAt: new Date().toISOString(),
      })
      .onConflictDoNothing();

    // Update counters
    const followerCount = await updateFollowerCount(db, targetUserId);
    await updateFollowingCount(db, currentUserId);

    const response: FollowResponse = {
      following: true,
      followerCount,
    };

    return c.json(response, 201);
  } catch (error) {
    console.error("Error following user:", error);
    return c.json({ error: "Failed to follow user" }, 500);
  }
});

// ============================================================================
// DELETE /api/users/:userId/follow - Unfollow user
// ============================================================================

follows.delete("/:userId/follow", async (c) => {
  const db = c.get("db");
  const currentUserId = c.get("userId");

  // Require authentication
  if (!requireAuth(currentUserId)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Validate userId
  const paramResult = userIdParamSchema.safeParse({
    userId: c.req.param("userId"),
  });

  if (!paramResult.success) {
    return c.json(
      {
        error: "Invalid user ID",
        details: paramResult.error.flatten().fieldErrors,
      },
      400
    );
  }

  const { userId: targetUserId } = paramResult.data;

  // Verify target user exists
  const targetUser = await verifyUserExists(db, targetUserId);
  if (!targetUser) {
    return c.json({ error: "User not found" }, 404);
  }

  try {
    // Delete follow (idempotent - no error if doesn't exist)
    await db
      .delete(schema.follows)
      .where(
        and(
          eq(schema.follows.followerId, currentUserId),
          eq(schema.follows.followingId, targetUserId)
        )
      );

    // Update counters
    const followerCount = await updateFollowerCount(db, targetUserId);
    await updateFollowingCount(db, currentUserId);

    const response: FollowResponse = {
      following: false,
      followerCount,
    };

    return c.json(response, 200);
  } catch (error) {
    console.error("Error unfollowing user:", error);
    return c.json({ error: "Failed to unfollow user" }, 500);
  }
});

// ============================================================================
// GET /api/users/:userId/followers - List followers
// ============================================================================

follows.get("/:userId/followers", async (c) => {
  const db = c.get("db");
  const currentUserId = c.get("userId");

  // Validate userId
  const paramResult = userIdParamSchema.safeParse({
    userId: c.req.param("userId"),
  });

  if (!paramResult.success) {
    return c.json(
      {
        error: "Invalid user ID",
        details: paramResult.error.flatten().fieldErrors,
      },
      400
    );
  }

  const { userId: targetUserId } = paramResult.data;

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

  // Verify target user exists
  const targetUser = await verifyUserExists(db, targetUserId);
  if (!targetUser) {
    return c.json({ error: "User not found" }, 404);
  }

  // Decode cursor if provided
  let cursorData: { createdAt: string; id: string } | null = null;
  if (cursor) {
    cursorData = decodeCursor(cursor);
    if (!cursorData) {
      return c.json({ error: "Invalid cursor" }, 400);
    }
  }

  try {
    // Build cursor condition
    const cursorCondition = cursorData
      ? or(
          lt(schema.follows.createdAt, cursorData.createdAt),
          and(
            eq(schema.follows.createdAt, cursorData.createdAt),
            lt(schema.follows.id, cursorData.id)
          )
        )
      : undefined;

    // Fetch followers with user info
    const results = await db
      .select({
        id: schema.follows.id,
        createdAt: schema.follows.createdAt,
        user: {
          id: schema.users.id,
          name: schema.users.name,
          displayName: schema.users.displayName,
          avatarUrl: schema.users.avatarUrl,
        },
      })
      .from(schema.follows)
      .innerJoin(schema.users, eq(schema.follows.followerId, schema.users.id))
      .where(
        and(
          eq(schema.follows.followingId, targetUserId),
          isNull(schema.users.deletedAt),
          cursorCondition
        )
      )
      .orderBy(desc(schema.follows.createdAt), desc(schema.follows.id))
      .limit(limit + 1);

    // Check if there are more results
    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;

    // Check if current user is following target user
    let isFollowing = false;
    if (currentUserId) {
      const [follow] = await db
        .select({ id: schema.follows.id })
        .from(schema.follows)
        .where(
          and(
            eq(schema.follows.followerId, currentUserId),
            eq(schema.follows.followingId, targetUserId)
          )
        )
        .limit(1);
      isFollowing = !!follow;
    }

    // Generate next cursor
    const nextCursor =
      hasMore && data.length > 0
        ? encodeCursor({
            createdAt: data[data.length - 1].createdAt,
            id: data[data.length - 1].id,
          })
        : null;

    const response: FollowListResponse = {
      data: data.map((item) => item.user as UserSummary),
      nextCursor,
      hasMore,
      isFollowing,
    };

    return c.json(response, 200);
  } catch (error) {
    console.error("Error listing followers:", error);
    return c.json({ error: "Failed to list followers" }, 500);
  }
});

// ============================================================================
// GET /api/users/:userId/following - List following
// ============================================================================

follows.get("/:userId/following", async (c) => {
  const db = c.get("db");
  const _currentUserId = c.get("userId");

  // Validate userId
  const paramResult = userIdParamSchema.safeParse({
    userId: c.req.param("userId"),
  });

  if (!paramResult.success) {
    return c.json(
      {
        error: "Invalid user ID",
        details: paramResult.error.flatten().fieldErrors,
      },
      400
    );
  }

  const { userId: targetUserId } = paramResult.data;

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

  // Verify target user exists
  const targetUser = await verifyUserExists(db, targetUserId);
  if (!targetUser) {
    return c.json({ error: "User not found" }, 404);
  }

  // Decode cursor if provided
  let cursorData: { createdAt: string; id: string } | null = null;
  if (cursor) {
    cursorData = decodeCursor(cursor);
    if (!cursorData) {
      return c.json({ error: "Invalid cursor" }, 400);
    }
  }

  try {
    // Build cursor condition
    const cursorCondition = cursorData
      ? or(
          lt(schema.follows.createdAt, cursorData.createdAt),
          and(
            eq(schema.follows.createdAt, cursorData.createdAt),
            lt(schema.follows.id, cursorData.id)
          )
        )
      : undefined;

    // Fetch following with user info
    const results = await db
      .select({
        id: schema.follows.id,
        createdAt: schema.follows.createdAt,
        user: {
          id: schema.users.id,
          name: schema.users.name,
          displayName: schema.users.displayName,
          avatarUrl: schema.users.avatarUrl,
        },
      })
      .from(schema.follows)
      .innerJoin(schema.users, eq(schema.follows.followingId, schema.users.id))
      .where(
        and(
          eq(schema.follows.followerId, targetUserId),
          isNull(schema.users.deletedAt),
          cursorCondition
        )
      )
      .orderBy(desc(schema.follows.createdAt), desc(schema.follows.id))
      .limit(limit + 1);

    // Check if there are more results
    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;

    // Generate next cursor
    const nextCursor =
      hasMore && data.length > 0
        ? encodeCursor({
            createdAt: data[data.length - 1].createdAt,
            id: data[data.length - 1].id,
          })
        : null;

    const response: FollowListResponse = {
      data: data.map((item) => item.user as UserSummary),
      nextCursor,
      hasMore,
    };

    return c.json(response, 200);
  } catch (error) {
    console.error("Error listing following:", error);
    return c.json({ error: "Failed to list following" }, 500);
  }
});

export default follows;
