/**
 * Public Statistics and Showcase Data Queries
 *
 * Shared query functions for public data retrieval.
 * These functions are used by both SSR pages and API routes
 * to ensure consistent public data access conditions.
 */

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "../client";
import { notDeleted } from "../helpers";
import * as schema from "../schema";

/**
 * Maximum number of items for showcase display
 * Prevents large IN clause expansion in SQLite
 */
const MAX_SHOWCASE_LIMIT = 12;

/**
 * Platform Statistics
 */
export interface PlatformStats {
  bonsaiCount: number;
  userCount: number;
  imageCount: number;
}

/**
 * Bonsai Showcase Item (minimal data for display)
 */
export interface BonsaiShowcaseItem {
  id: string;
  name: string;
  description: string | null;
  thumbnailUrl: string | null;
  speciesNameJa: string | null;
  styleNameJa: string | null;
  likeCount: number;
  commentCount: number;
}

/**
 * Get platform statistics for public bonsai
 *
 * Counts:
 * - Public bonsai (non-deleted, isPublic=true)
 * - Users who have public bonsai
 * - Images of public bonsai
 *
 * @param db - Database connection
 * @returns Platform statistics
 */
export async function getPublicStats(db: Database): Promise<PlatformStats> {
  // Run all count queries in parallel for better performance
  const [[bonsaiResult], [userResult], [imageResult]] = await Promise.all([
    // Count public bonsai
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.bonsai)
      .where(and(notDeleted(schema.bonsai), eq(schema.bonsai.isPublic, true))),

    // Count users with public bonsai
    db
      .select({ count: sql<number>`count(distinct ${schema.bonsai.userId})` })
      .from(schema.bonsai)
      .where(and(notDeleted(schema.bonsai), eq(schema.bonsai.isPublic, true))),

    // Count images of public bonsai (using JOIN for consistent conditions)
    db
      .select({ count: sql<number>`count(${schema.bonsaiImages.id})` })
      .from(schema.bonsaiImages)
      .innerJoin(
        schema.bonsai,
        eq(schema.bonsaiImages.bonsaiId, schema.bonsai.id)
      )
      .where(and(notDeleted(schema.bonsai), eq(schema.bonsai.isPublic, true))),
  ]);

  return {
    bonsaiCount: Number(bonsaiResult?.count ?? 0),
    userCount: Number(userResult?.count ?? 0),
    imageCount: Number(imageResult?.count ?? 0),
  };
}

/**
 * Get public bonsai for showcase display
 *
 * Returns the latest public bonsai with:
 * - Basic info (name, description)
 * - Primary thumbnail image
 * - Species and style names
 * - Social stats (like/comment counts)
 *
 * @param db - Database connection
 * @param limit - Maximum number of items to return
 * @returns Array of bonsai showcase items
 */
export async function getPublicBonsaiShowcase(
  db: Database,
  limit: number
): Promise<BonsaiShowcaseItem[]> {
  // Clamp limit to prevent large IN clause expansion
  const safeLimit = Math.min(Math.max(1, limit), MAX_SHOWCASE_LIMIT);

  // Get public bonsai (latest first)
  const bonsaiList = await db
    .select({
      id: schema.bonsai.id,
      name: schema.bonsai.name,
      description: schema.bonsai.description,
      speciesId: schema.bonsai.speciesId,
      styleId: schema.bonsai.styleId,
      likeCount: schema.bonsai.likeCount,
      commentCount: schema.bonsai.commentCount,
    })
    .from(schema.bonsai)
    .where(and(notDeleted(schema.bonsai), eq(schema.bonsai.isPublic, true)))
    .orderBy(desc(schema.bonsai.createdAt), desc(schema.bonsai.id))
    .limit(safeLimit);

  if (bonsaiList.length === 0) {
    return [];
  }

  const bonsaiIds = bonsaiList.map((b) => b.id);

  // Get species names
  const speciesIds = [
    ...new Set(bonsaiList.map((b) => b.speciesId).filter(Boolean)),
  ] as string[];
  const speciesMap = new Map<string, string>();
  if (speciesIds.length > 0) {
    const speciesList = await db
      .select({ id: schema.species.id, nameJa: schema.species.nameJa })
      .from(schema.species)
      .where(inArray(schema.species.id, speciesIds));
    for (const s of speciesList) {
      speciesMap.set(s.id, s.nameJa);
    }
  }

  // Get style names
  const styleIds = [
    ...new Set(bonsaiList.map((b) => b.styleId).filter(Boolean)),
  ] as string[];
  const styleMap = new Map<string, string>();
  if (styleIds.length > 0) {
    const stylesList = await db
      .select({ id: schema.styles.id, nameJa: schema.styles.nameJa })
      .from(schema.styles)
      .where(inArray(schema.styles.id, styleIds));
    for (const s of stylesList) {
      styleMap.set(s.id, s.nameJa);
    }
  }

  // Get primary thumbnail images
  const thumbnailMap = new Map<string, string>();
  const primaryImages = await db
    .select({
      bonsaiId: schema.bonsaiImages.bonsaiId,
      thumbnailUrl: schema.bonsaiImages.thumbnailUrl,
    })
    .from(schema.bonsaiImages)
    .where(
      and(
        inArray(schema.bonsaiImages.bonsaiId, bonsaiIds),
        eq(schema.bonsaiImages.isPrimary, true)
      )
    );
  for (const img of primaryImages) {
    if (img.thumbnailUrl) {
      thumbnailMap.set(img.bonsaiId, img.thumbnailUrl);
    }
  }

  // Build showcase items
  return bonsaiList.map((b) => ({
    id: b.id,
    name: b.name,
    description: b.description,
    thumbnailUrl: thumbnailMap.get(b.id) ?? null,
    speciesNameJa: b.speciesId ? (speciesMap.get(b.speciesId) ?? null) : null,
    styleNameJa: b.styleId ? (styleMap.get(b.styleId) ?? null) : null,
    likeCount: b.likeCount,
    commentCount: b.commentCount,
  }));
}
