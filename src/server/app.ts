import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { timing } from "hono/timing";

import type { R2BucketBinding } from "@/lib/storage/r2";
import type { KVNamespace } from "./middleware/rate-limit";
import { rateLimiter } from "./middleware/rate-limit";
import adminRoutes from "./routes/admin";
import adminSettingsRoutes from "./routes/admin-settings";
import adminStatsRoutes from "./routes/admin-stats";
import adminUsersRoutes from "./routes/admin-users";
import authRoutes from "./routes/auth";
import bonsaiRoutes from "./routes/bonsai";
import careLogsRoutes from "./routes/care-logs";
import commentsRoutes from "./routes/comments";
import followsRoutes from "./routes/follows";
import imagesRoutes from "./routes/images";
import likesRoutes from "./routes/likes";
import mastersRoutes from "./routes/masters";
import usersRoutes from "./routes/users";

// Create Hono app with environment bindings type
type Bindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  PUBLIC_APP_URL: string;
  NODE_ENV?: string;
  // OAuth
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  // Session
  SESSION_SECRET: string;
  // R2 Storage
  R2_BUCKET: R2BucketBinding;
  R2_PUBLIC_URL?: string;
  // KV for Rate Limiting
  RATE_LIMIT_KV?: KVNamespace;
  // Admin
  ADMIN_USER_IDS?: string;
};

// biome-ignore lint/complexity/noBannedTypes: Hono requires this type signature for future variable additions
type Variables = {};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Middleware
app.use("*", logger());
app.use("*", timing());
app.use("*", async (c, next) => {
  const appUrl = c.env?.PUBLIC_APP_URL || "http://localhost:4321";
  const nodeEnv = c.env?.NODE_ENV || "development";

  // Parse allowed origins for safer comparison
  const allowedOrigins =
    nodeEnv === "development"
      ? [
          "http://localhost:4321",
          "http://localhost:3000",
          "http://127.0.0.1:4321",
        ]
      : [appUrl];

  // Pre-parse allowed origins for comparison
  const parsedAllowedOrigins = allowedOrigins
    .map((o) => {
      try {
        const url = new URL(o);
        return `${url.protocol}//${url.host}`;
      } catch {
        return null;
      }
    })
    .filter((o): o is string => o !== null);

  const corsMiddleware = cors({
    origin: (origin) => {
      // Allow requests with no origin (same-origin, curl, etc.)
      if (!origin) return appUrl;

      // Parse and normalize the incoming origin for safer comparison
      try {
        const parsedOrigin = new URL(origin);
        const normalizedOrigin = `${parsedOrigin.protocol}//${parsedOrigin.host}`;

        // Check if normalized origin is in allowed list
        if (parsedAllowedOrigins.includes(normalizedOrigin)) {
          return normalizedOrigin;
        }
      } catch {
        // Invalid origin URL, reject
      }

      // Reject other origins
      return null;
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    credentials: true,
  });

  return corsMiddleware(c, next);
});

// Rate limiting middleware (after CORS, before routes)
// Note: Rate limiting is skipped if KV is not available (local development)
app.use(
  "/api/*",
  rateLimiter({
    skip: (c) => {
      // Skip rate limiting for health checks and safe methods
      if (
        c.req.method === "GET" ||
        c.req.method === "HEAD" ||
        c.req.method === "OPTIONS"
      ) {
        return true;
      }
      return false;
    },
  })
);

// Health check endpoint
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// API version prefix
const api = app.basePath("/api");

// Auth routes
api.route("/auth", authRoutes);

// Master data routes (species, styles, tags)
api.route("/masters", mastersRoutes);

// Bonsai CRUD routes
api.route("/bonsai", bonsaiRoutes);

// Care logs routes (nested under bonsai)
api.route("/bonsai", careLogsRoutes);

// Bonsai image routes
api.route("/bonsai", imagesRoutes);

// Social: Likes routes (nested under bonsai)
api.route("/bonsai", likesRoutes);

// Social: Comments routes (nested under bonsai)
api.route("/bonsai", commentsRoutes);

// Social: Follows routes (nested under users)
api.route("/users", followsRoutes);

// User profile routes
api.route("/users", usersRoutes);

// Admin routes (moderation)
api.route("/admin", adminRoutes);

// Admin stats routes
api.route("/admin", adminStatsRoutes);

// Admin users routes
api.route("/admin/users", adminUsersRoutes);

// Admin settings routes
api.route("/admin/settings", adminSettingsRoutes);

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: "Not Found",
      message: `Route ${c.req.path} not found`,
    },
    404
  );
});

// Error handler
app.onError((err, c) => {
  console.error(`Error: ${err.message}`, err.stack);
  const isDev = c.env?.NODE_ENV !== "production";
  return c.json(
    {
      error: "Internal Server Error",
      message: isDev ? err.message : "An unexpected error occurred",
    },
    500
  );
});

export default app;
export type AppType = typeof app;
