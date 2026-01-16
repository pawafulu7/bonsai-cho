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
import { IMAGE_LIMITS, isCloudflareWorkersEnv } from "@/lib/env";
import {
  deleteImage,
  generateImageKey,
  type R2BucketBinding,
  uploadImage,
} from "@/lib/storage/r2";
import {
  getExtensionFromMimeType,
  validateImageFile,
} from "@/lib/storage/validation";
import { bonsaiIdParamSchema } from "./bonsai.schema";

// Re-export for backward compatibility
export { bonsaiIdParamSchema };

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

export const uploadQuerySchema = z.object({
  caption: z.string().max(500).optional(),
  takenAt: z.string().datetime().optional(),
});

export const imageIdParamSchema = z.object({
  bonsaiId: z.string().min(1, "Bonsai ID is required"),
  imageId: z.string().min(1, "Image ID is required"),
});

export const reorderSchema = z.object({
  imageIds: z
    .array(z.string().min(1))
    .min(1, "At least one image ID is required"),
});

export const updateImageSchema = z.object({
  caption: z.string().max(500).optional(),
  isPrimary: z.boolean().optional(),
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

  // Generate thumbnail (only in Cloudflare Workers environment)
  // @cf-wasm/photon/workerd requires WASM which is not supported in Node.js
  let thumbnailUrl: string | null = null;

  if (isCloudflareWorkersEnv()) {
    try {
      // Dynamic import to avoid WASM loading at startup in Node.js
      const { generateThumbnail } = await import("@/lib/image/thumbnail");

      const thumbnailResult = await generateThumbnail(arrayBuffer, {
        targetSize: IMAGE_LIMITS.thumbnailSize,
      });

      // Upload thumbnail to R2
      // Ensure we only upload the actual thumbnail data, not the entire underlying buffer
      const thumbnailKey = generateImageKey(bonsaiId, "thumbnail", "webp");
      const thumbnailBuffer = thumbnailResult.data.buffer.slice(
        thumbnailResult.data.byteOffset,
        thumbnailResult.data.byteOffset + thumbnailResult.data.byteLength
      ) as ArrayBuffer;
      const thumbnailUploadResult = await uploadImage(
        bucket,
        thumbnailKey,
        thumbnailBuffer,
        "image/webp"
      );

      if (thumbnailUploadResult) {
        thumbnailUrl = thumbnailKey;
      } else {
        console.error(
          "[ThumbnailGeneration] Failed to upload thumbnail to R2",
          {
            bonsaiId,
            originalKey,
          }
        );
      }
    } catch (error) {
      // Log structured error and continue without thumbnail (fallback)
      // Re-import for error type checking (already loaded if we got here)
      const { logThumbnailError, ThumbnailGenerationError } = await import(
        "@/lib/image/thumbnail"
      );

      if (error instanceof ThumbnailGenerationError) {
        logThumbnailError(error, { bonsaiId, originalKey });
      } else {
        console.error("[ThumbnailGeneration] Unexpected error", {
          bonsaiId,
          originalKey,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } else {
    // Node.js environment: skip thumbnail generation
    console.info("[ThumbnailGeneration] Skipped in non-Workers environment", {
      bonsaiId,
      originalKey,
    });
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
    thumbnailUrl,
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
      thumbnailUrl,
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

/**
 * PATCH /api/bonsai/:bonsaiId/images/reorder
 * Reorder images for a bonsai (updates sortOrder)
 *
 * Uses transaction to ensure atomic updates.
 * Security: Verifies bonsai ownership and that all imageIds belong to the bonsai.
 */
images.patch("/:bonsaiId/images/reorder", async (c) => {
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

  // Parse and validate request body
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const bodyResult = reorderSchema.safeParse(body);
  if (!bodyResult.success) {
    return c.json(
      { error: "Invalid request body", details: bodyResult.error.flatten() },
      400
    );
  }
  const { imageIds } = bodyResult.data;

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

  // Verify all imageIds belong to this bonsai (IDOR prevention)
  const existingImages = await db
    .select({ id: schema.bonsaiImages.id })
    .from(schema.bonsaiImages)
    .where(eq(schema.bonsaiImages.bonsaiId, bonsaiId));

  const existingImageIds = new Set(existingImages.map((img) => img.id));
  const invalidIds = imageIds.filter((id) => !existingImageIds.has(id));

  if (invalidIds.length > 0) {
    return c.json(
      { error: "Some image IDs do not belong to this bonsai" },
      400
    );
  }

  // Check for duplicates in imageIds
  const uniqueIds = new Set(imageIds);
  if (uniqueIds.size !== imageIds.length) {
    return c.json({ error: "Duplicate image IDs in request" }, 400);
  }

  // Update sort order using transaction (batch update)
  try {
    await db.transaction(async (tx) => {
      for (let i = 0; i < imageIds.length; i++) {
        await tx
          .update(schema.bonsaiImages)
          .set({ sortOrder: i })
          .where(
            and(
              eq(schema.bonsaiImages.id, imageIds[i]),
              eq(schema.bonsaiImages.bonsaiId, bonsaiId)
            )
          );
      }
    });
  } catch (error) {
    console.error("Failed to reorder images:", error);
    return c.json({ error: "Failed to reorder images" }, 500);
  }

  return c.json({ success: true, imageIds });
});

/**
 * PATCH /api/bonsai/:bonsaiId/images/:imageId
 * Update image metadata (caption, isPrimary)
 *
 * When setting isPrimary=true, clears isPrimary from other images.
 */
images.patch("/:bonsaiId/images/:imageId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  // Validate params
  const paramResult = imageIdParamSchema.safeParse({
    bonsaiId: c.req.param("bonsaiId"),
    imageId: c.req.param("imageId"),
  });
  if (!paramResult.success) {
    return c.json({ error: "Invalid parameters" }, 400);
  }
  const { bonsaiId, imageId } = paramResult.data;

  // Parse and validate request body
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const bodyResult = updateImageSchema.safeParse(body);
  if (!bodyResult.success) {
    return c.json(
      { error: "Invalid request body", details: bodyResult.error.flatten() },
      400
    );
  }
  const updates = bodyResult.data;

  // Ensure at least one field to update
  if (updates.caption === undefined && updates.isPrimary === undefined) {
    return c.json({ error: "No fields to update" }, 400);
  }

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

  // Verify image exists and belongs to this bonsai (IDOR prevention)
  const imageRecord = await db
    .select()
    .from(schema.bonsaiImages)
    .where(
      and(
        eq(schema.bonsaiImages.id, imageId),
        eq(schema.bonsaiImages.bonsaiId, bonsaiId)
      )
    )
    .limit(1);

  if (imageRecord.length === 0) {
    return c.json({ error: "Image not found" }, 404);
  }

  // Update image with transaction (for isPrimary handling)
  try {
    await db.transaction(async (tx) => {
      // If setting isPrimary, clear it from other images first
      if (updates.isPrimary === true) {
        await tx
          .update(schema.bonsaiImages)
          .set({ isPrimary: false })
          .where(eq(schema.bonsaiImages.bonsaiId, bonsaiId));
      }

      // Build update object
      const updateData: Partial<typeof schema.bonsaiImages.$inferInsert> = {};
      if (updates.caption !== undefined) {
        updateData.caption = updates.caption || null;
      }
      if (updates.isPrimary !== undefined) {
        updateData.isPrimary = updates.isPrimary;
      }

      // Update the target image
      await tx
        .update(schema.bonsaiImages)
        .set(updateData)
        .where(eq(schema.bonsaiImages.id, imageId));
    });
  } catch (error) {
    console.error("Failed to update image:", error);
    return c.json({ error: "Failed to update image" }, 500);
  }

  // Fetch updated image
  const updatedImage = await db
    .select()
    .from(schema.bonsaiImages)
    .where(eq(schema.bonsaiImages.id, imageId))
    .limit(1);

  return c.json({ image: updatedImage[0] });
});

/**
 * DELETE /api/bonsai/:bonsaiId/images/:imageId
 * Delete an image
 *
 * Deletes from both R2 storage and database.
 * If deleting the primary image, promotes the next image to primary.
 */
images.delete("/:bonsaiId/images/:imageId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  // Validate params
  const paramResult = imageIdParamSchema.safeParse({
    bonsaiId: c.req.param("bonsaiId"),
    imageId: c.req.param("imageId"),
  });
  if (!paramResult.success) {
    return c.json({ error: "Invalid parameters" }, 400);
  }
  const { bonsaiId, imageId } = paramResult.data;

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

  // Verify image exists and belongs to this bonsai (IDOR prevention)
  const imageRecord = await db
    .select()
    .from(schema.bonsaiImages)
    .where(
      and(
        eq(schema.bonsaiImages.id, imageId),
        eq(schema.bonsaiImages.bonsaiId, bonsaiId)
      )
    )
    .limit(1);

  if (imageRecord.length === 0) {
    return c.json({ error: "Image not found" }, 404);
  }

  const image = imageRecord[0];
  const wasPrimary = image.isPrimary;

  // Delete from R2 storage
  const bucket = c.env.R2_BUCKET;
  try {
    await deleteImage(bucket, image.imageUrl);
    // Also delete thumbnail if exists
    if (image.thumbnailUrl) {
      await deleteImage(bucket, image.thumbnailUrl);
    }
  } catch (error) {
    console.error("Failed to delete image from R2:", error);
    // Continue with database deletion even if R2 fails
    // (orphaned R2 objects can be cleaned up later)
  }

  // Delete from database and handle primary promotion
  try {
    await db.transaction(async (tx) => {
      // Delete the image
      await tx
        .delete(schema.bonsaiImages)
        .where(eq(schema.bonsaiImages.id, imageId));

      // If it was primary, promote the first remaining image
      if (wasPrimary) {
        const remainingImages = await tx
          .select({ id: schema.bonsaiImages.id })
          .from(schema.bonsaiImages)
          .where(eq(schema.bonsaiImages.bonsaiId, bonsaiId))
          .orderBy(schema.bonsaiImages.sortOrder)
          .limit(1);

        if (remainingImages.length > 0) {
          await tx
            .update(schema.bonsaiImages)
            .set({ isPrimary: true })
            .where(eq(schema.bonsaiImages.id, remainingImages[0].id));
        }
      }
    });
  } catch (error) {
    console.error("Failed to delete image from database:", error);
    return c.json({ error: "Failed to delete image" }, 500);
  }

  return c.json({ success: true, deletedId: imageId });
});

export default images;
