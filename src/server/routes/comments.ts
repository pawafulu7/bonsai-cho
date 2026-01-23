/**
 * Comments API Routes
 *
 * Handles comment CRUD operations for bonsai posts.
 * Implements soft delete and permission checks.
 */

import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { generateId } from "@/lib/auth/crypto";
import { parseCsrfCookie, validateCsrfToken } from "@/lib/auth/csrf";
import { parseSessionCookie, validateSession } from "@/lib/auth/session";
import { type Database, getDb } from "@/lib/db/client";
import { decodeCursor, encodeCursor, notDeleted } from "@/lib/db/helpers";
import * as schema from "@/lib/db/schema";

import {
  bonsaiIdParamSchema,
  type CommentItem,
  type CommentListResponse,
  commentIdParamSchema,
  createCommentSchema,
  paginationQuerySchema,
  type UserSummary,
  updateCommentSchema,
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

// Create Hono app for comments routes
const comments = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ============================================================================
// Middleware
// ============================================================================

// Database middleware
comments.use("*", async (c, next) => {
  const db = await getDb(c.env.TURSO_DATABASE_URL, c.env.TURSO_AUTH_TOKEN);
  c.set("db", db);
  await next();
});

// Optional auth middleware - sets userId if authenticated, null otherwise
comments.use("*", async (c, next) => {
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
  c: Parameters<Parameters<typeof comments.use>[1]>[0],
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

comments.use("*", csrfMiddleware);

// Helper function to require authentication
function requireAuth(userId: string | null): userId is string {
  return userId !== null;
}

// ============================================================================
// Helper: Verify bonsai access
// ============================================================================

async function verifyBonsaiAccess(
  db: Database,
  bonsaiId: string,
  userId: string | null
): Promise<
  | { allowed: true; bonsai: { id: string; userId: string; isPublic: boolean } }
  | { allowed: false; status: 404 }
> {
  const [targetBonsai] = await db
    .select({
      id: schema.bonsai.id,
      userId: schema.bonsai.userId,
      isPublic: schema.bonsai.isPublic,
    })
    .from(schema.bonsai)
    .where(and(eq(schema.bonsai.id, bonsaiId), notDeleted(schema.bonsai)))
    .limit(1);

  if (!targetBonsai) {
    return { allowed: false, status: 404 };
  }

  // Non-public bonsai: only owner can access
  if (!targetBonsai.isPublic && targetBonsai.userId !== userId) {
    return { allowed: false, status: 404 };
  }

  return { allowed: true, bonsai: targetBonsai };
}

// ============================================================================
// Helper: Update comment count
// ============================================================================

async function updateCommentCount(
  db: Database,
  bonsaiId: string
): Promise<number> {
  // Use subquery to get accurate count (prevents race conditions)
  // Only count non-deleted comments
  const [result] = await db
    .update(schema.bonsai)
    .set({
      commentCount: sql`(SELECT COUNT(*) FROM ${schema.comments} WHERE ${schema.comments.bonsaiId} = ${bonsaiId} AND ${schema.comments.deletedAt} IS NULL)`,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.bonsai.id, bonsaiId))
    .returning({ commentCount: schema.bonsai.commentCount });

  return result?.commentCount ?? 0;
}

// ============================================================================
// Helper: Format comment for response
// ============================================================================

function formatComment(
  comment: {
    id: string;
    userId: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    user: {
      id: string;
      name: string;
      displayName: string | null;
      avatarUrl: string | null;
      deletedAt: string | null;
    };
  },
  currentUserId: string | null
): CommentItem {
  // Show "Retired User" for deleted users
  const userSummary: UserSummary = comment.user.deletedAt
    ? {
        id: comment.user.id,
        name: "Retired User",
        displayName: null,
        avatarUrl: null,
      }
    : {
        id: comment.user.id,
        name: comment.user.name,
        displayName: comment.user.displayName,
        avatarUrl: comment.user.avatarUrl,
      };

  return {
    id: comment.id,
    userId: comment.userId,
    user: userSummary,
    content: comment.content,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    isOwner: currentUserId === comment.userId,
  };
}

// ============================================================================
// GET /api/bonsai/:bonsaiId/comments - List comments
// ============================================================================

comments.get("/:bonsaiId/comments", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  // Validate bonsaiId
  const paramResult = bonsaiIdParamSchema.safeParse({
    bonsaiId: c.req.param("bonsaiId"),
  });

  if (!paramResult.success) {
    return c.json(
      {
        error: "Invalid bonsai ID",
        details: z.treeifyError(paramResult.error),
      },
      400
    );
  }

  const { bonsaiId } = paramResult.data;

  // Parse query parameters
  const queryResult = paginationQuerySchema.safeParse({
    cursor: c.req.query("cursor"),
    limit: c.req.query("limit"),
  });

  if (!queryResult.success) {
    return c.json(
      {
        error: "Invalid query parameters",
        details: z.treeifyError(queryResult.error),
      },
      400
    );
  }

  const { cursor, limit } = queryResult.data;

  // Verify bonsai access
  const accessResult = await verifyBonsaiAccess(db, bonsaiId, userId);
  if (!accessResult.allowed) {
    return c.json({ error: "Bonsai not found" }, 404);
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
          lt(schema.comments.createdAt, cursorData.createdAt),
          and(
            eq(schema.comments.createdAt, cursorData.createdAt),
            lt(schema.comments.id, cursorData.id)
          )
        )
      : undefined;

    // Fetch comments with user info
    const results = await db
      .select({
        id: schema.comments.id,
        userId: schema.comments.userId,
        content: schema.comments.content,
        createdAt: schema.comments.createdAt,
        updatedAt: schema.comments.updatedAt,
        user: {
          id: schema.users.id,
          name: schema.users.name,
          displayName: schema.users.displayName,
          avatarUrl: schema.users.avatarUrl,
          deletedAt: schema.users.deletedAt,
        },
      })
      .from(schema.comments)
      .innerJoin(schema.users, eq(schema.comments.userId, schema.users.id))
      .where(
        and(
          eq(schema.comments.bonsaiId, bonsaiId),
          isNull(schema.comments.deletedAt),
          cursorCondition
        )
      )
      .orderBy(desc(schema.comments.createdAt), desc(schema.comments.id))
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

    const response: CommentListResponse = {
      data: data.map((comment) => formatComment(comment, userId)),
      nextCursor,
      hasMore,
    };

    return c.json(response, 200);
  } catch (error) {
    console.error("Error listing comments:", error);
    return c.json({ error: "Failed to list comments" }, 500);
  }
});

// ============================================================================
// POST /api/bonsai/:bonsaiId/comments - Add comment
// ============================================================================

comments.post("/:bonsaiId/comments", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  // Require authentication
  if (!requireAuth(userId)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Validate bonsaiId
  const paramResult = bonsaiIdParamSchema.safeParse({
    bonsaiId: c.req.param("bonsaiId"),
  });

  if (!paramResult.success) {
    return c.json(
      {
        error: "Invalid bonsai ID",
        details: z.treeifyError(paramResult.error),
      },
      400
    );
  }

  const { bonsaiId } = paramResult.data;

  // Verify bonsai access
  const accessResult = await verifyBonsaiAccess(db, bonsaiId, userId);
  if (!accessResult.allowed) {
    return c.json({ error: "Bonsai not found" }, 404);
  }

  // Parse and validate body
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const bodyResult = createCommentSchema.safeParse(body);
  if (!bodyResult.success) {
    return c.json(
      {
        error: "Invalid request body",
        details: z.treeifyError(bodyResult.error),
      },
      400
    );
  }

  const { content } = bodyResult.data;

  try {
    const now = new Date().toISOString();
    const commentId = generateId();

    // Insert comment
    await db.insert(schema.comments).values({
      id: commentId,
      userId,
      bonsaiId,
      content,
      createdAt: now,
      updatedAt: now,
    });

    // Update comment count
    await updateCommentCount(db, bonsaiId);

    // Fetch the created comment with user info for response
    const [createdComment] = await db
      .select({
        id: schema.comments.id,
        userId: schema.comments.userId,
        content: schema.comments.content,
        createdAt: schema.comments.createdAt,
        updatedAt: schema.comments.updatedAt,
        user: {
          id: schema.users.id,
          name: schema.users.name,
          displayName: schema.users.displayName,
          avatarUrl: schema.users.avatarUrl,
          deletedAt: schema.users.deletedAt,
        },
      })
      .from(schema.comments)
      .innerJoin(schema.users, eq(schema.comments.userId, schema.users.id))
      .where(eq(schema.comments.id, commentId))
      .limit(1);

    // Handle case where comment was created but couldn't be fetched
    if (!createdComment) {
      console.error(
        `Comment created (id: ${commentId}) but failed to fetch for response. ` +
          `bonsaiId: ${bonsaiId}, userId: ${userId}`
      );
      // Return minimal success response since the comment WAS created
      return c.json(
        {
          comment: {
            id: commentId,
            userId,
            user: {
              id: userId,
              name: "Unknown",
              displayName: null,
              avatarUrl: null,
            },
            content,
            createdAt: now,
            updatedAt: now,
            isOwner: true,
          },
        },
        201
      );
    }

    return c.json(
      {
        comment: formatComment(createdComment, userId),
      },
      201
    );
  } catch (error) {
    console.error("Error adding comment:", error);
    return c.json({ error: "Failed to add comment" }, 500);
  }
});

// ============================================================================
// PATCH /api/bonsai/:bonsaiId/comments/:commentId - Edit comment
// ============================================================================

comments.patch("/:bonsaiId/comments/:commentId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  // Require authentication
  if (!requireAuth(userId)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Validate params
  const paramResult = commentIdParamSchema.safeParse({
    bonsaiId: c.req.param("bonsaiId"),
    commentId: c.req.param("commentId"),
  });

  if (!paramResult.success) {
    return c.json(
      {
        error: "Invalid parameters",
        details: z.treeifyError(paramResult.error),
      },
      400
    );
  }

  const { bonsaiId, commentId } = paramResult.data;

  // Verify bonsai access
  const accessResult = await verifyBonsaiAccess(db, bonsaiId, userId);
  if (!accessResult.allowed) {
    return c.json({ error: "Bonsai not found" }, 404);
  }

  // Find comment (IDOR prevention: verify bonsaiId matches)
  const [comment] = await db
    .select({
      id: schema.comments.id,
      userId: schema.comments.userId,
      bonsaiId: schema.comments.bonsaiId,
    })
    .from(schema.comments)
    .where(
      and(
        eq(schema.comments.id, commentId),
        eq(schema.comments.bonsaiId, bonsaiId),
        isNull(schema.comments.deletedAt)
      )
    )
    .limit(1);

  if (!comment) {
    return c.json({ error: "Comment not found" }, 404);
  }

  // Only comment owner can edit
  if (comment.userId !== userId) {
    return c.json({ error: "Comment not found" }, 404);
  }

  // Parse and validate body
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const bodyResult = updateCommentSchema.safeParse(body);
  if (!bodyResult.success) {
    return c.json(
      {
        error: "Invalid request body",
        details: z.treeifyError(bodyResult.error),
      },
      400
    );
  }

  const { content } = bodyResult.data;

  try {
    // Update comment
    await db
      .update(schema.comments)
      .set({
        content,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.comments.id, commentId));

    return c.json({ message: "Comment updated successfully" }, 200);
  } catch (error) {
    console.error("Error updating comment:", error);
    return c.json({ error: "Failed to update comment" }, 500);
  }
});

// ============================================================================
// DELETE /api/bonsai/:bonsaiId/comments/:commentId - Delete comment
// ============================================================================

comments.delete("/:bonsaiId/comments/:commentId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  // Require authentication
  if (!requireAuth(userId)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Validate params
  const paramResult = commentIdParamSchema.safeParse({
    bonsaiId: c.req.param("bonsaiId"),
    commentId: c.req.param("commentId"),
  });

  if (!paramResult.success) {
    return c.json(
      {
        error: "Invalid parameters",
        details: z.treeifyError(paramResult.error),
      },
      400
    );
  }

  const { bonsaiId, commentId } = paramResult.data;

  // Verify bonsai access
  const accessResult = await verifyBonsaiAccess(db, bonsaiId, userId);
  if (!accessResult.allowed) {
    return c.json({ error: "Bonsai not found" }, 404);
  }

  // Find comment (IDOR prevention: verify bonsaiId matches)
  const [comment] = await db
    .select({
      id: schema.comments.id,
      userId: schema.comments.userId,
      bonsaiId: schema.comments.bonsaiId,
    })
    .from(schema.comments)
    .where(
      and(
        eq(schema.comments.id, commentId),
        eq(schema.comments.bonsaiId, bonsaiId),
        isNull(schema.comments.deletedAt)
      )
    )
    .limit(1);

  if (!comment) {
    return c.json({ error: "Comment not found" }, 404);
  }

  // Only comment owner or bonsai owner can delete
  const isBonsaiOwner = accessResult.bonsai.userId === userId;
  const isCommentOwner = comment.userId === userId;

  if (!isCommentOwner && !isBonsaiOwner) {
    return c.json({ error: "Comment not found" }, 404);
  }

  try {
    // Soft delete comment
    await db
      .update(schema.comments)
      .set({
        deletedAt: new Date().toISOString(),
      })
      .where(eq(schema.comments.id, commentId));

    // Update comment count
    await updateCommentCount(db, bonsaiId);

    return c.json({ message: "Comment deleted successfully" }, 200);
  } catch (error) {
    console.error("Error deleting comment:", error);
    return c.json({ error: "Failed to delete comment" }, 500);
  }
});

export default comments;
