import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

// Create libSQL client
const createDbClient = (url: string, authToken?: string) => {
  return createClient({
    url,
    authToken,
  });
};

// Create Drizzle instance
export const createDb = (url: string, authToken?: string) => {
  const client = createDbClient(url, authToken);

  // Enable foreign keys for SQLite
  client.execute("PRAGMA foreign_keys = ON");

  return drizzle(client, { schema });
};

// Type export for use in API routes
export type Database = ReturnType<typeof createDb>;
