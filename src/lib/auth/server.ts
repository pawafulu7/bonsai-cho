/**
 * Server-side authentication utilities for Astro
 *
 * Used to get the current user in Astro components and API routes.
 * Note: Admin authentication is handled separately by middleware
 * and admin data is available via Astro.locals.adminUser.
 */

import { createClient } from "@libsql/client";
import type { AstroGlobal } from "astro";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/lib/db/schema";
import { parseCsrfCookie } from "./csrf";
import {
  parseSessionCookie,
  type SessionUser,
  validateSession,
} from "./session";

/**
 * Get the current authenticated user from the request
 *
 * Returns null if not authenticated
 */
export async function getUser(
  request: Request,
  env: {
    TURSO_DATABASE_URL: string;
    TURSO_AUTH_TOKEN: string;
  }
): Promise<SessionUser | null> {
  const cookieHeader = request.headers.get("Cookie");
  const sessionToken = parseSessionCookie(cookieHeader);

  if (!sessionToken) {
    return null;
  }

  const client = createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
  const db = drizzle(client, { schema });

  const result = await validateSession(db as never, sessionToken);

  if (!result) {
    return null;
  }

  return result.user;
}

/**
 * Get the CSRF token from the request cookies
 */
export function getCsrfToken(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  return parseCsrfCookie(cookieHeader);
}

/**
 * Get auth data for use in Astro components
 *
 * Usage in .astro files:
 * ```astro
 * ---
 * import { getAuthData } from "@/lib/auth/server";
 * const { user, csrfToken } = await getAuthData(Astro);
 * ---
 * ```
 */
export async function getAuthData(astro: AstroGlobal): Promise<{
  user: SessionUser | null;
  csrfToken: string | null;
}> {
  const env = {
    TURSO_DATABASE_URL: import.meta.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: import.meta.env.TURSO_AUTH_TOKEN,
  };

  const user = await getUser(astro.request, env);
  const csrfToken = getCsrfToken(astro.request);

  return { user, csrfToken };
}

/**
 * @deprecated Admin authentication is now handled by separate middleware.
 * Admin user data is available via Astro.locals.adminUser in /manage routes.
 * CSRF token is available via getCsrfToken().
 *
 * For admin pages:
 * - Middleware automatically checks admin session
 * - Admin user data: Astro.locals.adminUser
 * - isAdmin: Astro.locals.isAdmin
 *
 * This function is kept for backward compatibility but may be removed in future versions.
 */
export async function getAdminAuthData(astro: AstroGlobal): Promise<{
  user: SessionUser | null;
  isAdmin: boolean;
  csrfToken: string | null;
}> {
  const csrfToken = getCsrfToken(astro.request);

  // Admin auth is now separate - check Astro.locals.adminUser
  // This function can only check regular user auth
  const { user } = await getAuthData(astro);

  return {
    user,
    isAdmin: false, // Regular users can't be admins anymore
    csrfToken,
  };
}
