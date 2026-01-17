import { z } from "zod";

// Environment variable schema
// TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required for database operations
const envSchema = z.object({
  // Turso Database (required)
  TURSO_DATABASE_URL: z.url(),
  TURSO_AUTH_TOKEN: z.string().min(1, "TURSO_AUTH_TOKEN cannot be empty"),

  // App
  PUBLIC_APP_URL: z.url().default("http://localhost:4321"),

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

  // R2 Storage (optional - can use binding directly)
  R2_PUBLIC_URL: z.url().optional(),
});

// Image upload constants (static)
export const IMAGE_LIMITS = {
  maxFileSizeBytes: 10 * 1024 * 1024, // 10MB
  maxImagesPerBonsai: 50,
  maxStoragePerUserBytes: 500 * 1024 * 1024, // 500MB
  maxPixelDimension: 4000, // 4000x4000 max to prevent decompression bombs
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] as const,
  allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"] as const,
  thumbnailSize: 400, // 400x400px
};

// Parse and validate environment variables
export const parseEnv = (env: Record<string, string | undefined>) => {
  const result = envSchema.safeParse(env);

  if (!result.success) {
    console.error("Invalid environment variables:");
    console.error(z.treeifyError(result.error));
    throw new Error("Invalid environment variables");
  }

  return result.data;
};

// Type for validated environment
export type Env = z.infer<typeof envSchema>;

// Export schema for reference
export { envSchema };

/**
 * Cloudflare Workers environment detection
 *
 * Checks if the code is running in Cloudflare Workers by examining
 * the navigator.userAgent, which contains "Cloudflare-Workers" in Workers environment.
 *
 * This is used to conditionally load WASM modules that are only compatible
 * with Cloudflare Workers (e.g., @cf-wasm/photon/workerd).
 *
 * @returns true if running in Cloudflare Workers, false otherwise (Node.js, browser, etc.)
 */
export function isCloudflareWorkersEnv(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.userAgent === "string" &&
    navigator.userAgent.includes("Cloudflare-Workers")
  );
}
