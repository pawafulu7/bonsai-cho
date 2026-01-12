import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

// Create Drizzle instance with foreign keys enabled
export const createDb = async (url: string, authToken?: string) => {
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

  return drizzle(client, { schema });
};

// Type export for use in API routes
export type Database = Awaited<ReturnType<typeof createDb>>;
