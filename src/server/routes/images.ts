/**
 * Bonsai Image Routes
 *
 * Handles image upload, retrieval, and management for bonsai entries.
 * Uses Cloudflare R2 for storage.
 */

import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { generateId } from "@/lib/auth/crypto";
import { parseCsrfCookie, validateCsrfToken } from "@/lib/auth/csrf";
import { parseSessionCookie, validateSession } from "@/lib/auth/session";
import { type Database, getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { IMAGE_LIMITS } from "@/lib/env";
import {
  generateImageKey,
  type R2BucketBinding,
  uploadImage,
} from "@/lib/storage/r2";
import {
  getExtensionFromMimeType,
  validateImageFile,
} from "@/lib/storage/validation";

// Types
type Bindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  PUBLIC_APP_URL: string;
  SESSION_SECRET: string;
  R2_BUCKET: R2BucketBinding;
  R2_PUBLIC_URL?: string;
};

type Variables = {
  db: Database;
  userId: string;
};

// Zod schemas
const bonsaiIdParamSchema = z.object({
  bonsaiId: z.string().min(1, "Bonsai ID is required"),
});

const uploadQuerySchema = z.object({
  caption: z.string().max(500).optional(),
  takenAt: z.string().datetime().optional(),
});

// Create Hono app for image routes
const images = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Database middleware
images.use("*", async (c, next) => {
  const db = await getDb(c.env.TURSO_DATABASE_URL, c.env.TURSO_AUTH_TOKEN);
  c.set("db", db);
  await next();
});

// Auth middleware - require authentication for all image routes
images.use("*", async (c, next) => {
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
  c: Parameters<Parameters<typeof images.use>[1]>[0],
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

images.use("*", csrfMiddleware);

/**
 * POST /api/bonsai/:bonsaiId/images
 * Upload a new image for a bonsai
 */
images.post("/:bonsaiId/images", async (c) => {
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

  // Verify bonsai ownership (IDOR prevention)
  const bonsaiRecord = await db
    .select({ id: schema.bonsai.id })
    .from(schema.bonsai)
    .where(
      and(
        eq(schema.bonsai.id, bonsaiId),
        eq(schema.bonsai.userId, userId),
        sql`${schema.bonsai.deletedAt} IS NULL`
      )
    )
    .limit(1);

  if (bonsaiRecord.length === 0) {
    return c.json({ error: "Bonsai not found" }, 404);
  }

  // Check image count limit
  const imageCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.bonsaiImages)
    .where(eq(schema.bonsaiImages.bonsaiId, bonsaiId));

  if (imageCount[0].count >= IMAGE_LIMITS.maxImagesPerBonsai) {
    return c.json(
      {
        error: `Maximum image limit (${IMAGE_LIMITS.maxImagesPerBonsai}) reached for this bonsai`,
      },
      400
    );
  }

  // Check Content-Length before parsing to prevent DoS via large requests
  const contentLength = c.req.header("Content-Length");
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    // Allow some overhead for multipart boundaries and metadata
    const maxRequestSize = IMAGE_LIMITS.maxFileSizeBytes + 1024 * 100; // +100KB overhead
    if (size > maxRequestSize) {
      return c.json(
        {
          error: `Request size exceeds maximum allowed (${IMAGE_LIMITS.maxFileSizeBytes / (1024 * 1024)}MB)`,
        },
        413
      );
    }
  }

  // Parse multipart form data
  const contentType = c.req.header("Content-Type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return c.json({ error: "Content-Type must be multipart/form-data" }, 400);
  }

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: "Failed to parse form data" }, 400);
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return c.json({ error: "No file provided" }, 400);
  }

  // Validate query parameters (caption, takenAt)
  const queryResult = uploadQuerySchema.safeParse({
    caption: formData.get("caption")?.toString(),
    takenAt: formData.get("takenAt")?.toString(),
  });
  if (!queryResult.success) {
    return c.json(
      { error: "Invalid parameters", details: queryResult.error.flatten() },
      400
    );
  }
  const { caption, takenAt } = queryResult.data;

  // Read file data
  const arrayBuffer = await file.arrayBuffer();

  // Comprehensive file validation
  const validationResult = await validateImageFile({
    filename: file.name,
    contentType: file.type,
    size: file.size,
    data: arrayBuffer,
  });

  if (!validationResult.valid) {
    return c.json({ error: validationResult.error }, 400);
  }

  const detectedType = validationResult.detectedType!;

  // Generate R2 object keys
  const extension = getExtensionFromMimeType(detectedType).slice(1); // Remove leading dot
  const originalKey = generateImageKey(bonsaiId, "original", extension);

  // Upload to R2
  const bucket = c.env.R2_BUCKET;
  const uploadResult = await uploadImage(
    bucket,
    originalKey,
    arrayBuffer,
    detectedType
  );

  if (!uploadResult) {
    return c.json({ error: "Failed to upload image" }, 500);
  }

  // Get next sort order
  const maxSortOrder = await db
    .select({ maxOrder: sql<number>`COALESCE(MAX(sort_order), -1)` })
    .from(schema.bonsaiImages)
    .where(eq(schema.bonsaiImages.bonsaiId, bonsaiId));

  const sortOrder = (maxSortOrder[0]?.maxOrder ?? -1) + 1;

  // Check if this is the first image (make it primary)
  const isPrimary = imageCount[0].count === 0;

  // Create database record
  const imageId = generateId();
  const now = new Date().toISOString();

  await db.insert(schema.bonsaiImages).values({
    id: imageId,
    bonsaiId,
    imageUrl: originalKey,
    thumbnailUrl: null, // Thumbnail generation is Phase 3-B
    caption: caption || null,
    takenAt: takenAt || null,
    sortOrder,
    isPrimary,
    createdAt: now,
  });

  // Return created image info
  return c.json(
    {
      id: imageId,
      bonsaiId,
      imageUrl: originalKey,
      thumbnailUrl: null,
      caption: caption || null,
      takenAt: takenAt || null,
      sortOrder,
      isPrimary,
      createdAt: now,
    },
    201
  );
});

/**
 * GET /api/bonsai/:bonsaiId/images
 * List all images for a bonsai
 */
images.get("/:bonsaiId/images", async (c) => {
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

  // Verify bonsai ownership or public access
  const bonsaiRecord = await db
    .select({
      id: schema.bonsai.id,
      userId: schema.bonsai.userId,
      isPublic: schema.bonsai.isPublic,
    })
    .from(schema.bonsai)
    .where(
      and(
        eq(schema.bonsai.id, bonsaiId),
        sql`${schema.bonsai.deletedAt} IS NULL`
      )
    )
    .limit(1);

  if (bonsaiRecord.length === 0) {
    return c.json({ error: "Bonsai not found" }, 404);
  }

  // Check access rights
  const record = bonsaiRecord[0];
  if (record.userId !== userId && !record.isPublic) {
    return c.json({ error: "Access denied" }, 403);
  }

  // Fetch images
  const imageRecords = await db
    .select()
    .from(schema.bonsaiImages)
    .where(eq(schema.bonsaiImages.bonsaiId, bonsaiId))
    .orderBy(schema.bonsaiImages.sortOrder);

  return c.json({ images: imageRecords });
});

export default images;
