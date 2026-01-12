import type { APIRoute } from "astro";
import { parseEnv } from "@/lib/env";
import app from "@/server/app";

// Environment bindings type for Hono
type HonoEnv = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  PUBLIC_APP_URL: string;
  NODE_ENV: string;
};

// Validate and get environment variables
// Re-validates on each call to avoid stale cache issues in development
const getValidatedEnv = (): HonoEnv => {
  const rawEnv = {
    TURSO_DATABASE_URL: import.meta.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: import.meta.env.TURSO_AUTH_TOKEN,
    PUBLIC_APP_URL: import.meta.env.PUBLIC_APP_URL,
    NODE_ENV: import.meta.env.MODE,
  };

  const parsed = parseEnv(rawEnv);

  return {
    TURSO_DATABASE_URL: parsed.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: parsed.TURSO_AUTH_TOKEN,
    PUBLIC_APP_URL: parsed.PUBLIC_APP_URL,
    NODE_ENV: parsed.NODE_ENV,
  };
};

// Fail fast: validate on module load in production
if (import.meta.env.PROD) {
  getValidatedEnv();
}

// Handle all API routes through Hono
export const ALL: APIRoute = async (context) => {
  // Create a new Request with the correct URL path
  const url = new URL(context.request.url);

  // Get the route parameter and construct the API path
  const route = context.params.route || "";
  const apiPath = `/api/${route}`;

  // Create new URL with the API path
  const newUrl = new URL(apiPath, url.origin);
  newUrl.search = url.search;

  // Create a new request with the modified URL
  const request = new Request(newUrl.toString(), {
    method: context.request.method,
    headers: context.request.headers,
    body:
      context.request.method !== "GET" && context.request.method !== "HEAD"
        ? context.request.body
        : undefined,
    // @ts-expect-error - duplex is needed for streaming but not in types
    duplex: "half",
  });

  // Get validated environment bindings for Hono (for Cloudflare Workers)
  const env = getValidatedEnv();

  return app.fetch(request, env);
};
