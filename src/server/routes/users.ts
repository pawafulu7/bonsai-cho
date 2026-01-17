/**
 * Users API Routes
 *
 * Handles user profile retrieval and updates.
 * GET /api/users/:userId - Get user profile
 * PATCH /api/users/me - Update own profile
 */

import { and, count, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { parseCsrfCookie, validateCsrfToken } from "@/lib/auth/csrf";
import { parseSessionCookie, validateSession } from "@/lib/auth/session";
import { type Database, getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

import {
  type UpdateProfileResponse,
  type UserProfileResponse,
  updateProfileSchema,
  userIdParamSchema,
} from "./users.schema";

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

// Create Hono app for users routes
const users = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ============================================================================
// Middleware
// ============================================================================

// Database middleware
users.use("*", async (c, next) => {
  const db = await getDb(c.env.TURSO_DATABASE_URL, c.env.TURSO_AUTH_TOKEN);
  c.set("db", db);
  await next();
});

// Optional auth middleware - sets userId if authenticated, null otherwise
users.use("*", async (c, next) => {
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
  c: Parameters<Parameters<typeof users.use>[1]>[0],
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

users.use("*", csrfMiddleware);

// Helper function to require authentication
function requireAuth(userId: string | null): userId is string {
  return userId !== null;
}

// ============================================================================
// GET /api/users/:userId - Get user profile
// ============================================================================

users.get("/:userId", async (c) => {
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
        details: z.treeifyError(paramResult.error),
      },
      400
    );
  }

  const { userId: targetUserId } = paramResult.data;

  try {
    const isSelf = currentUserId === targetUserId;

    // Run all queries in parallel for better performance
    const [userResult, bonsaiCountResult, followResult] = await Promise.all([
      // Fetch user (excluding deleted users)
      db
        .select({
          id: schema.users.id,
          name: schema.users.name,
          displayName: schema.users.displayName,
          avatarUrl: schema.users.avatarUrl,
          bio: schema.users.bio,
          location: schema.users.location,
          website: schema.users.website,
          followerCount: schema.users.followerCount,
          followingCount: schema.users.followingCount,
          createdAt: schema.users.createdAt,
        })
        .from(schema.users)
        .where(
          and(eq(schema.users.id, targetUserId), isNull(schema.users.deletedAt))
        )
        .limit(1),

      // Calculate bonsaiCount
      // Owner (isSelf=true): Total bonsai count (excluding deleted)
      // Others: Public bonsai only (isPublic=true, deletedAt=null)
      isSelf
        ? db
            .select({ count: count() })
            .from(schema.bonsai)
            .where(
              and(
                eq(schema.bonsai.userId, targetUserId),
                isNull(schema.bonsai.deletedAt)
              )
            )
        : db
            .select({ count: count() })
            .from(schema.bonsai)
            .where(
              and(
                eq(schema.bonsai.userId, targetUserId),
                eq(schema.bonsai.isPublic, true),
                isNull(schema.bonsai.deletedAt)
              )
            ),

      // Check if current user is following target user (only if authenticated and not self)
      currentUserId && !isSelf
        ? db
            .select({ id: schema.follows.id })
            .from(schema.follows)
            .where(
              and(
                eq(schema.follows.followerId, currentUserId),
                eq(schema.follows.followingId, targetUserId)
              )
            )
            .limit(1)
        : Promise.resolve([]),
    ]);

    const [user] = userResult;
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    const bonsaiCount = bonsaiCountResult[0]?.count ?? 0;
    const isFollowing =
      currentUserId && !isSelf ? followResult.length > 0 : null;

    const response: UserProfileResponse = {
      id: user.id,
      name: user.name,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      location: user.location,
      website: user.website,
      followerCount: user.followerCount,
      followingCount: user.followingCount,
      bonsaiCount,
      isFollowing,
      isSelf,
      createdAt: user.createdAt,
    };

    return c.json(response, 200);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return c.json({ error: "Failed to fetch user profile" }, 500);
  }
});

// ============================================================================
// PATCH /api/users/me - Update own profile
// ============================================================================

users.patch("/me", async (c) => {
  const db = c.get("db");
  const currentUserId = c.get("userId");

  // Require authentication
  if (!requireAuth(currentUserId)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Parse and validate request body
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parseResult = updateProfileSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json(
      {
        error: "Validation failed",
        details: z.treeifyError(parseResult.error),
      },
      400
    );
  }

  const updateData = parseResult.data;

  // Check if there's anything to update
  const hasUpdates = Object.values(updateData).some(
    (value) => value !== undefined
  );
  if (!hasUpdates) {
    return c.json({ error: "No fields to update" }, 400);
  }

  try {
    // Build update object (only include defined fields)
    const updateFields: Partial<{
      displayName: string | null;
      bio: string | null;
      location: string | null;
      website: string | null;
      updatedAt: string;
    }> = {
      updatedAt: new Date().toISOString(),
    };

    if (updateData.displayName !== undefined) {
      updateFields.displayName = updateData.displayName;
    }
    if (updateData.bio !== undefined) {
      updateFields.bio = updateData.bio;
    }
    if (updateData.location !== undefined) {
      updateFields.location = updateData.location;
    }
    if (updateData.website !== undefined) {
      updateFields.website = updateData.website;
    }

    // Update user profile
    const [updatedUser] = await db
      .update(schema.users)
      .set(updateFields)
      .where(
        and(eq(schema.users.id, currentUserId), isNull(schema.users.deletedAt))
      )
      .returning({
        id: schema.users.id,
        name: schema.users.name,
        displayName: schema.users.displayName,
        avatarUrl: schema.users.avatarUrl,
        bio: schema.users.bio,
        location: schema.users.location,
        website: schema.users.website,
        updatedAt: schema.users.updatedAt,
      });

    if (!updatedUser) {
      return c.json({ error: "User not found" }, 404);
    }

    const response: UpdateProfileResponse = {
      id: updatedUser.id,
      name: updatedUser.name,
      displayName: updatedUser.displayName,
      avatarUrl: updatedUser.avatarUrl,
      bio: updatedUser.bio,
      location: updatedUser.location,
      website: updatedUser.website,
      updatedAt: updatedUser.updatedAt,
    };

    return c.json(response, 200);
  } catch (error) {
    console.error("Error updating user profile:", error);
    return c.json({ error: "Failed to update profile" }, 500);
  }
});

export default users;
