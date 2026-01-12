import { type Client, createClient } from "@libsql/client";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// Database type for API routes (does not expose internal client)
export type Database = LibSQLDatabase<typeof schema>;

// Internal connection result (client exposed only for cleanup in scripts)
type DbConnection = {
  db: Database;
  client: Client;
};

// Cache for DB connections keyed by URL (singleton per connection string)
// This prevents creating new connections on every request
const dbCache = new Map<string, DbConnection>();

/**
 * Get or create a cached database connection
 *
 * Uses singleton pattern to reuse connections within the same process/isolate.
 * This is recommended by Turso to avoid connection overhead and socket exhaustion.
 *
 * @param url - Turso database URL
 * @param authToken - Turso auth token
 * @returns Cached or newly created database connection
 */
export const getDb = (url: string, authToken?: string): Database => {
  const cacheKey = `${url}:${authToken ?? ""}`;

  let cached = dbCache.get(cacheKey);
  if (cached) {
    return cached.db;
  }

  const client = createClient({
    url,
    authToken,
  });

  const db = drizzle(client, { schema });
  cached = { db, client };
  dbCache.set(cacheKey, cached);

  return db;
};

/**
 * Create Drizzle instance with foreign keys enabled
 *
 * Returns both db and client - client is for cleanup only (e.g., in seed scripts).
 * Note: This creates a new connection each time, use getDb() for cached connections.
 */
export const createDb = async (
  url: string,
  authToken?: string
): Promise<DbConnection> => {
  const client = createClient({
    url,
    authToken,
  });

  // Enable foreign keys for SQLite
  try {
    await client.execute("PRAGMA foreign_keys = ON");
  } catch (error) {
    console.error("Failed to enable foreign keys:", error);
    throw error;
  }

  return { db: drizzle(client, { schema }), client };
};
