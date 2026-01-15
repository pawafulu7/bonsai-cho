/**
 * Master Data API Routes
 *
 * Public endpoints for species, styles, and tags.
 * These are read-only endpoints that don't require authentication.
 */

import { desc } from "drizzle-orm";
import { Hono } from "hono";

import { type Database, getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

// Types for Hono context
type Bindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
};

type Variables = {
  db: Database;
};

const masters = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ============================================================================
// Database Middleware
// ============================================================================

masters.use("*", async (c, next) => {
  const db = await getDb(c.env.TURSO_DATABASE_URL, c.env.TURSO_AUTH_TOKEN);
  c.set("db", db);
  await next();
});

// ============================================================================
// GET /api/species - List all species
// ============================================================================

masters.get("/species", async (c) => {
  const db = c.get("db");

  try {
    const speciesList = await db
      .select({
        id: schema.species.id,
        nameJa: schema.species.nameJa,
        nameEn: schema.species.nameEn,
        nameScientific: schema.species.nameScientific,
        description: schema.species.description,
      })
      .from(schema.species)
      .orderBy(schema.species.nameJa);

    // Set cache headers (1 hour)
    c.header("Cache-Control", "public, max-age=3600");

    return c.json({
      data: speciesList,
    });
  } catch (error) {
    console.error("Error fetching species:", error);
    return c.json({ error: "Failed to fetch species" }, 500);
  }
});

// ============================================================================
// GET /api/styles - List all styles
// ============================================================================

masters.get("/styles", async (c) => {
  const db = c.get("db");

  try {
    const stylesList = await db
      .select({
        id: schema.styles.id,
        nameJa: schema.styles.nameJa,
        nameEn: schema.styles.nameEn,
        description: schema.styles.description,
      })
      .from(schema.styles)
      .orderBy(schema.styles.nameJa);

    // Set cache headers (1 hour)
    c.header("Cache-Control", "public, max-age=3600");

    return c.json({
      data: stylesList,
    });
  } catch (error) {
    console.error("Error fetching styles:", error);
    return c.json({ error: "Failed to fetch styles" }, 500);
  }
});

// ============================================================================
// GET /api/tags - List popular tags
// ============================================================================

masters.get("/tags", async (c) => {
  const db = c.get("db");

  try {
    const tagsList = await db
      .select({
        id: schema.tags.id,
        name: schema.tags.name,
        usageCount: schema.tags.usageCount,
      })
      .from(schema.tags)
      .orderBy(desc(schema.tags.usageCount))
      .limit(50); // Top 50 popular tags by usage count (descending)

    // Set cache headers (1 hour)
    c.header("Cache-Control", "public, max-age=3600");

    return c.json({
      data: tagsList,
    });
  } catch (error) {
    console.error("Error fetching tags:", error);
    return c.json({ error: "Failed to fetch tags" }, 500);
  }
});

export default masters;
