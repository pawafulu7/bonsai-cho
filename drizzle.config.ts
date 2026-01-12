import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.TURSO_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("TURSO_DATABASE_URL environment variable is required");
}

export default defineConfig({
  dialect: "turso",
  schema: "./src/lib/db/schema/index.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: databaseUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
