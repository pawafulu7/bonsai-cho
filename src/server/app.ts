import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { timing } from "hono/timing";

// Create Hono app with environment bindings type
type Bindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
};

type Variables = {
  // Add custom variables here
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Middleware
app.use("*", logger());
app.use("*", timing());
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
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

// Species endpoints (placeholder for Phase 4)
api.get("/species", async (c) => {
  // TODO: Implement with Drizzle
  return c.json({
    data: [],
    message: "Species endpoint - to be implemented",
  });
});

// Styles endpoints (placeholder for Phase 4)
api.get("/styles", async (c) => {
  // TODO: Implement with Drizzle
  return c.json({
    data: [],
    message: "Styles endpoint - to be implemented",
  });
});

// Bonsai endpoints (placeholder for Phase 4)
api.get("/bonsai", async (c) => {
  // TODO: Implement with Drizzle
  return c.json({
    data: [],
    message: "Bonsai endpoint - to be implemented",
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
  const isDev = process.env.NODE_ENV !== "production";
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
