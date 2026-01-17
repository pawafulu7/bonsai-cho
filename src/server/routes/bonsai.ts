/**
 * Bonsai CRUD API Routes
 *
 * Handles bonsai creation, retrieval, update, and deletion.
 * Implements cursor-based pagination and soft delete.
 */

import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { generateId } from "@/lib/auth/crypto";
import { parseCsrfCookie, validateCsrfToken } from "@/lib/auth/csrf";
import { parseSessionCookie, validateSession } from "@/lib/auth/session";
import { type Database, getDb } from "@/lib/db/client";
import { decodeCursor, encodeCursor, notDeleted } from "@/lib/db/helpers";
import * as schema from "@/lib/db/schema";

import {
  type BonsaiDetailResponse,
  type BonsaiListItem,
  type BonsaiListResponse,
  bonsaiIdParamSchema,
  createBonsaiSchema,
  paginationQuerySchema,
  updateBonsaiSchema,
} from "./bonsai.schema";

// Types
type Bindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  PUBLIC_APP_URL: string;
  SESSION_SECRET: string;
  R2_PUBLIC_URL?: string;
};

type Variables = {
  db: Database;
  userId: string | null;
};

// Create Hono app for bonsai routes
const bonsai = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ============================================================================
// Middleware
// ============================================================================

// Database middleware
bonsai.use("*", async (c, next) => {
  const db = await getDb(c.env.TURSO_DATABASE_URL, c.env.TURSO_AUTH_TOKEN);
  c.set("db", db);
  await next();
});

// Optional auth middleware - sets userId if authenticated, null otherwise
bonsai.use("*", async (c, next) => {
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
  c: Parameters<Parameters<typeof bonsai.use>[1]>[0],
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

bonsai.use("*", csrfMiddleware);

// Helper function to require authentication
function requireAuth(userId: string | null): userId is string {
  return userId !== null;
}

// ============================================================================
// GET /api/bonsai - List bonsai with cursor pagination
// ============================================================================

bonsai.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

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

  // Decode cursor if provided
  let cursorData: { createdAt: string; id: string } | null = null;
  if (cursor) {
    cursorData = decodeCursor(cursor);
    if (!cursorData) {
      return c.json({ error: "Invalid cursor" }, 400);
    }
  }

  try {
    // Build query conditions
    // Public bonsai or owned by current user (if authenticated)
    const accessCondition = userId
      ? or(eq(schema.bonsai.isPublic, true), eq(schema.bonsai.userId, userId))
      : eq(schema.bonsai.isPublic, true);

    // Cursor condition for pagination
    const cursorCondition = cursorData
      ? or(
          lt(schema.bonsai.createdAt, cursorData.createdAt),
          and(
            eq(schema.bonsai.createdAt, cursorData.createdAt),
            lt(schema.bonsai.id, cursorData.id)
          )
        )
      : undefined;

    // Combine all conditions
    const conditions = [
      notDeleted(schema.bonsai),
      accessCondition,
      cursorCondition,
    ].filter(Boolean);

    // Query bonsai with related data
    const bonsaiList = await db
      .select({
        id: schema.bonsai.id,
        name: schema.bonsai.name,
        description: schema.bonsai.description,
        speciesId: schema.bonsai.speciesId,
        styleId: schema.bonsai.styleId,
        isPublic: schema.bonsai.isPublic,
        likeCount: schema.bonsai.likeCount,
        commentCount: schema.bonsai.commentCount,
        createdAt: schema.bonsai.createdAt,
        updatedAt: schema.bonsai.updatedAt,
      })
      .from(schema.bonsai)
      .where(and(...conditions))
      .orderBy(desc(schema.bonsai.createdAt), desc(schema.bonsai.id))
      .limit(limit + 1); // Fetch one extra to determine hasMore

    // Determine if there are more results
    const hasMore = bonsaiList.length > limit;
    const results = hasMore ? bonsaiList.slice(0, limit) : bonsaiList;

    // Get species and styles for the results
    const bonsaiIds = results.map((b) => b.id);

    // Get species names
    const speciesIds = [
      ...new Set(results.map((b) => b.speciesId).filter(Boolean)),
    ] as string[];
    const speciesMap = new Map<string, string>();
    if (speciesIds.length > 0) {
      const speciesList = await db
        .select({ id: schema.species.id, nameJa: schema.species.nameJa })
        .from(schema.species)
        .where(
          sql`${schema.species.id} IN (${sql.join(
            speciesIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        );
      for (const s of speciesList) {
        speciesMap.set(s.id, s.nameJa);
      }
    }

    // Get style names
    const styleIds = [
      ...new Set(results.map((b) => b.styleId).filter(Boolean)),
    ] as string[];
    const styleMap = new Map<string, string>();
    if (styleIds.length > 0) {
      const stylesList = await db
        .select({ id: schema.styles.id, nameJa: schema.styles.nameJa })
        .from(schema.styles)
        .where(
          sql`${schema.styles.id} IN (${sql.join(
            styleIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        );
      for (const s of stylesList) {
        styleMap.set(s.id, s.nameJa);
      }
    }

    // Get primary images and image counts for each bonsai
    const imageData = new Map<
      string,
      { primaryUrl: string | null; thumbnailUrl: string | null; count: number }
    >();
    if (bonsaiIds.length > 0) {
      // Get primary images
      const primaryImages = await db
        .select({
          bonsaiId: schema.bonsaiImages.bonsaiId,
          imageUrl: schema.bonsaiImages.imageUrl,
          thumbnailUrl: schema.bonsaiImages.thumbnailUrl,
        })
        .from(schema.bonsaiImages)
        .where(
          and(
            sql`${schema.bonsaiImages.bonsaiId} IN (${sql.join(
              bonsaiIds.map((id) => sql`${id}`),
              sql`, `
            )})`,
            eq(schema.bonsaiImages.isPrimary, true)
          )
        );

      for (const img of primaryImages) {
        imageData.set(img.bonsaiId, {
          primaryUrl: img.imageUrl,
          thumbnailUrl: img.thumbnailUrl,
          count: 0,
        });
      }

      // Get image counts
      const imageCounts = await db
        .select({
          bonsaiId: schema.bonsaiImages.bonsaiId,
          count: sql<number>`count(*)`.as("count"),
        })
        .from(schema.bonsaiImages)
        .where(
          sql`${schema.bonsaiImages.bonsaiId} IN (${sql.join(
            bonsaiIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        )
        .groupBy(schema.bonsaiImages.bonsaiId);

      for (const count of imageCounts) {
        const existing = imageData.get(count.bonsaiId);
        if (existing) {
          existing.count = count.count;
        } else {
          imageData.set(count.bonsaiId, {
            primaryUrl: null,
            thumbnailUrl: null,
            count: count.count,
          });
        }
      }
    }

    // Build response
    const data: BonsaiListItem[] = results.map((b) => {
      const images = imageData.get(b.id);
      return {
        id: b.id,
        name: b.name,
        description: b.description,
        speciesId: b.speciesId,
        speciesNameJa: b.speciesId ? speciesMap.get(b.speciesId) || null : null,
        styleId: b.styleId,
        styleNameJa: b.styleId ? styleMap.get(b.styleId) || null : null,
        primaryImageUrl: images?.primaryUrl || null,
        thumbnailUrl: images?.thumbnailUrl || null,
        imageCount: images?.count || 0,
        likeCount: b.likeCount,
        commentCount: b.commentCount,
        isPublic: b.isPublic,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      };
    });

    // Generate next cursor
    const nextCursor =
      hasMore && results.length > 0
        ? encodeCursor({
            createdAt: results[results.length - 1].createdAt,
            id: results[results.length - 1].id,
          })
        : null;

    const response: BonsaiListResponse = {
      data,
      nextCursor,
      hasMore,
    };

    return c.json(response);
  } catch (error) {
    console.error("Error fetching bonsai list:", error);
    return c.json({ error: "Failed to fetch bonsai list" }, 500);
  }
});

// ============================================================================
// GET /api/bonsai/:bonsaiId - Get bonsai detail
// ============================================================================

bonsai.get("/:bonsaiId", async (c) => {
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

  try {
    // Fetch bonsai with species and style
    const [bonsaiRecord] = await db
      .select()
      .from(schema.bonsai)
      .where(and(eq(schema.bonsai.id, bonsaiId), notDeleted(schema.bonsai)))
      .limit(1);

    if (!bonsaiRecord) {
      return c.json({ error: "Bonsai not found" }, 404);
    }

    // Check access permission (existence oracle prevention)
    const canAccess = bonsaiRecord.isPublic || bonsaiRecord.userId === userId;
    if (!canAccess) {
      return c.json({ error: "Bonsai not found" }, 404);
    }

    // Fetch species if present
    let speciesData = null;
    if (bonsaiRecord.speciesId) {
      const [species] = await db
        .select()
        .from(schema.species)
        .where(eq(schema.species.id, bonsaiRecord.speciesId))
        .limit(1);
      if (species) {
        speciesData = {
          id: species.id,
          nameJa: species.nameJa,
          nameEn: species.nameEn,
          nameScientific: species.nameScientific,
        };
      }
    }

    // Fetch style if present
    let styleData = null;
    if (bonsaiRecord.styleId) {
      const [style] = await db
        .select()
        .from(schema.styles)
        .where(eq(schema.styles.id, bonsaiRecord.styleId))
        .limit(1);
      if (style) {
        styleData = {
          id: style.id,
          nameJa: style.nameJa,
          nameEn: style.nameEn,
        };
      }
    }

    // Fetch images
    const images = await db
      .select({
        id: schema.bonsaiImages.id,
        bonsaiId: schema.bonsaiImages.bonsaiId,
        imageUrl: schema.bonsaiImages.imageUrl,
        thumbnailUrl: schema.bonsaiImages.thumbnailUrl,
        caption: schema.bonsaiImages.caption,
        takenAt: schema.bonsaiImages.takenAt,
        isPrimary: schema.bonsaiImages.isPrimary,
        sortOrder: schema.bonsaiImages.sortOrder,
        createdAt: schema.bonsaiImages.createdAt,
      })
      .from(schema.bonsaiImages)
      .where(eq(schema.bonsaiImages.bonsaiId, bonsaiId))
      .orderBy(schema.bonsaiImages.sortOrder);

    // Fetch tags
    const tagsResult = await db
      .select({
        id: schema.tags.id,
        name: schema.tags.name,
      })
      .from(schema.bonsaiTags)
      .innerJoin(schema.tags, eq(schema.bonsaiTags.tagId, schema.tags.id))
      .where(eq(schema.bonsaiTags.bonsaiId, bonsaiId));

    // Check if current user has liked this bonsai
    let isLiked = false;
    if (userId) {
      const likeRecord = await db
        .select({ id: schema.likes.id })
        .from(schema.likes)
        .where(
          and(
            eq(schema.likes.bonsaiId, bonsaiId),
            eq(schema.likes.userId, userId)
          )
        )
        .limit(1);
      isLiked = likeRecord.length > 0;
    }

    const response: BonsaiDetailResponse = {
      id: bonsaiRecord.id,
      userId: bonsaiRecord.userId,
      name: bonsaiRecord.name,
      description: bonsaiRecord.description,
      speciesId: bonsaiRecord.speciesId,
      species: speciesData,
      styleId: bonsaiRecord.styleId,
      style: styleData,
      acquiredAt: bonsaiRecord.acquiredAt,
      estimatedAge: bonsaiRecord.estimatedAge,
      height: bonsaiRecord.height,
      width: bonsaiRecord.width,
      potDetails: bonsaiRecord.potDetails,
      isPublic: bonsaiRecord.isPublic,
      likeCount: bonsaiRecord.likeCount,
      commentCount: bonsaiRecord.commentCount,
      isLiked,
      images,
      tags: tagsResult,
      createdAt: bonsaiRecord.createdAt,
      updatedAt: bonsaiRecord.updatedAt,
    };

    return c.json(response);
  } catch (error) {
    console.error("Error fetching bonsai detail:", error);
    return c.json({ error: "Failed to fetch bonsai detail" }, 500);
  }
});

// ============================================================================
// POST /api/bonsai - Create new bonsai
// ============================================================================

bonsai.post("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  // Require authentication
  if (!requireAuth(userId)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    const parseResult = createBonsaiSchema.safeParse(body);

    if (!parseResult.success) {
      return c.json(
        {
          error: "Validation failed",
          details: z.treeifyError(parseResult.error),
        },
        400
      );
    }

    const data = parseResult.data;

    // Validate speciesId exists if provided
    if (data.speciesId) {
      const [species] = await db
        .select({ id: schema.species.id })
        .from(schema.species)
        .where(eq(schema.species.id, data.speciesId))
        .limit(1);

      if (!species) {
        return c.json({ error: "Invalid species ID" }, 400);
      }
    }

    // Validate styleId exists if provided
    if (data.styleId) {
      const [style] = await db
        .select({ id: schema.styles.id })
        .from(schema.styles)
        .where(eq(schema.styles.id, data.styleId))
        .limit(1);

      if (!style) {
        return c.json({ error: "Invalid style ID" }, 400);
      }
    }

    const now = new Date().toISOString();
    const bonsaiId = generateId();

    await db.insert(schema.bonsai).values({
      id: bonsaiId,
      userId,
      name: data.name,
      description: data.description ?? null,
      speciesId: data.speciesId ?? null,
      styleId: data.styleId ?? null,
      acquiredAt: data.acquiredAt ?? null,
      estimatedAge: data.estimatedAge ?? null,
      height: data.height ?? null,
      width: data.width ?? null,
      potDetails: data.potDetails ?? null,
      isPublic: data.isPublic,
      likeCount: 0,
      commentCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    return c.json(
      {
        id: bonsaiId,
        message: "Bonsai created successfully",
      },
      201
    );
  } catch (error) {
    console.error("Error creating bonsai:", error);
    return c.json({ error: "Failed to create bonsai" }, 500);
  }
});

// ============================================================================
// PATCH /api/bonsai/:bonsaiId - Update bonsai
// ============================================================================

bonsai.patch("/:bonsaiId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  // Require authentication
  if (!requireAuth(userId)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Validate bonsai ID
  const paramResult = bonsaiIdParamSchema.safeParse({
    bonsaiId: c.req.param("bonsaiId"),
  });
  if (!paramResult.success) {
    return c.json({ error: "Invalid bonsai ID" }, 400);
  }
  const { bonsaiId } = paramResult.data;

  try {
    // Verify ownership (IDOR prevention)
    const [existing] = await db
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

    if (!existing) {
      return c.json({ error: "Bonsai not found" }, 404);
    }

    const body = await c.req.json();
    const parseResult = updateBonsaiSchema.safeParse(body);

    if (!parseResult.success) {
      return c.json(
        {
          error: "Validation failed",
          details: z.treeifyError(parseResult.error),
        },
        400
      );
    }

    const data = parseResult.data;

    // Validate speciesId exists if provided
    if (data.speciesId) {
      const [species] = await db
        .select({ id: schema.species.id })
        .from(schema.species)
        .where(eq(schema.species.id, data.speciesId))
        .limit(1);

      if (!species) {
        return c.json({ error: "Invalid species ID" }, 400);
      }
    }

    // Validate styleId exists if provided
    if (data.styleId) {
      const [style] = await db
        .select({ id: schema.styles.id })
        .from(schema.styles)
        .where(eq(schema.styles.id, data.styleId))
        .limit(1);

      if (!style) {
        return c.json({ error: "Invalid style ID" }, 400);
      }
    }

    const now = new Date().toISOString();

    await db
      .update(schema.bonsai)
      .set({
        ...data,
        updatedAt: now,
      })
      .where(eq(schema.bonsai.id, bonsaiId));

    return c.json({ message: "Bonsai updated successfully" });
  } catch (error) {
    console.error("Error updating bonsai:", error);
    return c.json({ error: "Failed to update bonsai" }, 500);
  }
});

// ============================================================================
// DELETE /api/bonsai/:bonsaiId - Soft delete bonsai
// ============================================================================

bonsai.delete("/:bonsaiId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  // Require authentication
  if (!requireAuth(userId)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Validate bonsai ID
  const paramResult = bonsaiIdParamSchema.safeParse({
    bonsaiId: c.req.param("bonsaiId"),
  });
  if (!paramResult.success) {
    return c.json({ error: "Invalid bonsai ID" }, 400);
  }
  const { bonsaiId } = paramResult.data;

  try {
    // Verify ownership (IDOR prevention)
    const [existing] = await db
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

    if (!existing) {
      return c.json({ error: "Bonsai not found" }, 404);
    }

    const now = new Date().toISOString();

    // Soft delete
    await db
      .update(schema.bonsai)
      .set({
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.bonsai.id, bonsaiId));

    return c.json({ message: "Bonsai deleted successfully" });
  } catch (error) {
    console.error("Error deleting bonsai:", error);
    return c.json({ error: "Failed to delete bonsai" }, 500);
  }
});

export default bonsai;
