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

// Cache for DB connection promises keyed by URL (singleton per connection string)
// Using Promise cache prevents race conditions during concurrent initialization
const dbPromiseCache = new Map<string, Promise<DbConnection>>();

/**
 * Get or create a cached database connection with foreign keys enabled
 *
 * Uses singleton pattern with Promise caching to:
 * - Reuse connections within the same process/isolate (recommended by Turso)
 * - Prevent race conditions during concurrent initialization
 * - Avoid connection overhead and socket exhaustion
 *
 * Foreign keys are enabled during connection creation to ensure data integrity.
 *
 * @param url - Turso database URL
 * @param authToken - Turso auth token
 * @returns Cached or newly created database connection
 */
export const getDb = async (
  url: string,
  authToken?: string
): Promise<Database> => {
  const cacheKey = `${url}:${authToken ?? ""}`;

  // Check for existing promise (handles concurrent calls)
  const existingPromise = dbPromiseCache.get(cacheKey);
  if (existingPromise) {
    const cached = await existingPromise;
    return cached.db;
  }

  // Create and cache the initialization promise immediately
  // This ensures concurrent calls get the same promise
  const initPromise = (async (): Promise<DbConnection> => {
    const client = createClient({
      url,
      authToken,
    });

    // Enable foreign keys for SQLite
    await client.execute("PRAGMA foreign_keys = ON");

    const db = drizzle(client, { schema });
    return { db, client };
  })();

  dbPromiseCache.set(cacheKey, initPromise);

  try {
    const connection = await initPromise;
    return connection.db;
  } catch (error) {
    // Remove failed promise from cache to allow retry
    dbPromiseCache.delete(cacheKey);
    throw error;
  }
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
