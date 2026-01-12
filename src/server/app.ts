import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { timing } from "hono/timing";

// Create Hono app with environment bindings type
type Bindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  PUBLIC_APP_URL?: string;
  NODE_ENV?: string;
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

  // In development, allow localhost origins
  const allowedOrigins =
    nodeEnv === "development"
      ? [
          "http://localhost:4321",
          "http://localhost:3000",
          "http://127.0.0.1:4321",
        ]
      : [appUrl];

  const corsMiddleware = cors({
    origin: (origin) => {
      // Allow requests with no origin (same-origin, curl, etc.)
      if (!origin) return appUrl;
      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) return origin;
      // Reject other origins
      return null;
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  });

  return corsMiddleware(c, next);
});

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

// Species endpoints - Phase 4 implementation
api.get("/species", async (c) => {
  return c.json({
    data: [],
    message: "Species endpoint - Phase 4 implementation pending",
  });
});

// Styles endpoints - Phase 4 implementation
api.get("/styles", async (c) => {
  return c.json({
    data: [],
    message: "Styles endpoint - Phase 4 implementation pending",
  });
});

// Bonsai endpoints - Phase 4 implementation
api.get("/bonsai", async (c) => {
  return c.json({
    data: [],
    message: "Bonsai endpoint - Phase 4 implementation pending",
  });
});

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
