import { z } from "zod";

// Environment variable schema
// TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required for database operations
const envSchema = z.object({
  // Turso Database (required)
  TURSO_DATABASE_URL: z.string().url(),
  TURSO_AUTH_TOKEN: z.string().min(1, "TURSO_AUTH_TOKEN cannot be empty"),

  // App
  PUBLIC_APP_URL: z.string().url().default("http://localhost:4321"),

  // OAuth (required for authentication)
  GITHUB_CLIENT_ID: z.string().min(1, "GITHUB_CLIENT_ID is required"),
  GITHUB_CLIENT_SECRET: z.string().min(1, "GITHUB_CLIENT_SECRET is required"),
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),

  // Session encryption secret (32+ characters recommended)
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters"),

  // Node environment
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

// Parse and validate environment variables
export const parseEnv = (env: Record<string, string | undefined>) => {
  const result = envSchema.safeParse(env);

  if (!result.success) {
    console.error("Invalid environment variables:");
    console.error(result.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }

  return result.data;
};

// Type for validated environment
export type Env = z.infer<typeof envSchema>;

// Export schema for reference
export { envSchema };
