/**
 * Server-side authentication utilities for Astro
 *
 * Used to get the current user in Astro components and API routes.
 */

import { createClient } from "@libsql/client";
import type { AstroGlobal } from "astro";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/lib/db/schema";
import { isAdminUser } from "./admin";
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
 * Get admin auth data for use in admin Astro components
 *
 * Returns user, isAdmin flag, and csrfToken
 * If not authenticated or not admin, returns appropriate flags
 *
 * Usage in .astro files:
 * ```astro
 * ---
 * import { getAdminAuthData } from "@/lib/auth/server";
 * const { user, isAdmin, csrfToken } = await getAdminAuthData(Astro);
 * if (!isAdmin) {
 *   return Astro.redirect("/");
 * }
 * ---
 * ```
 */
export async function getAdminAuthData(astro: AstroGlobal): Promise<{
  user: SessionUser | null;
  isAdmin: boolean;
  csrfToken: string | null;
}> {
  const { user, csrfToken } = await getAuthData(astro);

  if (!user) {
    return { user: null, isAdmin: false, csrfToken };
  }

  const adminUserIdsEnv = import.meta.env.ADMIN_USER_IDS;
  const isAdmin = isAdminUser(user.id, adminUserIdsEnv);

  return { user, isAdmin, csrfToken };
}
