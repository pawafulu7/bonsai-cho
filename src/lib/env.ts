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

  // R2 Storage (optional - can use binding directly)
  R2_PUBLIC_URL: z.string().url().optional(),

  // Image Upload Limits
  MAX_FILE_SIZE_MB: z.coerce.number().positive().default(10),
  MAX_IMAGES_PER_BONSAI: z.coerce.number().positive().default(50),
  MAX_STORAGE_PER_USER_MB: z.coerce.number().positive().default(500),
});

// Image upload constants (derived from env)
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
    console.error(result.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }

  return result.data;
};

// Type for validated environment
export type Env = z.infer<typeof envSchema>;

// Export schema for reference
export { envSchema };
