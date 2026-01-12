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

// Create Drizzle instance with foreign keys enabled
// Returns both db and client - client is for cleanup only (e.g., in seed scripts)
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
