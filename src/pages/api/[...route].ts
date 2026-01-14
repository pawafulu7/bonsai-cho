import type { APIRoute } from "astro";
import { type Env, parseEnv } from "@/lib/env";
import type { R2BucketBinding } from "@/lib/storage/r2";
import app from "@/server/app";

// Extended bindings type including R2
interface RuntimeBindings extends Env {
  R2_BUCKET?: R2BucketBinding;
}

// Cache for validated environment (production only)
let cachedEnv: Env | null = null;

// Validate and get environment variables
// In production: caches result for performance (env vars don't change)
// In development: re-validates on each call to detect config changes
const getValidatedEnv = (): Env => {
  if (import.meta.env.PROD && cachedEnv) {
    return cachedEnv;
  }

  const rawEnv = {
    TURSO_DATABASE_URL: import.meta.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: import.meta.env.TURSO_AUTH_TOKEN,
    PUBLIC_APP_URL: import.meta.env.PUBLIC_APP_URL,
    NODE_ENV: import.meta.env.MODE,
    // OAuth
    GITHUB_CLIENT_ID: import.meta.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: import.meta.env.GITHUB_CLIENT_SECRET,
    GOOGLE_CLIENT_ID: import.meta.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: import.meta.env.GOOGLE_CLIENT_SECRET,
    // Session
    SESSION_SECRET: import.meta.env.SESSION_SECRET,
  };

  const validated = parseEnv(rawEnv);

  if (import.meta.env.PROD) {
    cachedEnv = validated;
  }

  return validated;
};

// Fail fast: validate and cache on module load in production
if (import.meta.env.PROD) {
  getValidatedEnv();
}

// Handle all API routes through Hono
export const ALL: APIRoute = async (context) => {
  // Create a new Request with the correct URL path
  const url = new URL(context.request.url);

  // Get the route parameter and construct the API path
  const route = context.params.route || "";

  // Prevent path traversal attacks
  if (route.includes("..") || route.includes("//") || route.includes("\\")) {
    return new Response(JSON.stringify({ error: "Invalid route" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

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

  // Get R2 bucket binding from Cloudflare runtime (available in Cloudflare Pages)
  // @ts-expect-error - Cloudflare runtime bindings are available through locals.runtime
  const runtime = context.locals?.runtime;
  const r2Bucket = runtime?.env?.R2_BUCKET as R2BucketBinding | undefined;

  // Combine env vars with runtime bindings
  const bindings: RuntimeBindings = {
    ...env,
    R2_BUCKET: r2Bucket,
  };

  return app.fetch(request, bindings);
};
