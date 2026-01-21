/**
 * Admin authentication utilities
 *
 * Provides functions for admin user validation and authentication.
 * Admin user IDs are configured via environment variables for security.
 */

import { parseCsrfCookie, validateCsrfToken } from "./csrf";
import { type Database, parseSessionCookie, validateSession } from "./session";

/**
 * Parse admin user IDs from environment variable
 *
 * Environment variable format: comma-separated list of user IDs
 * Example: "user_abc123,user_xyz789"
 */
export function getAdminUserIds(adminUserIdsEnv: string | undefined): string[] {
  if (!adminUserIdsEnv) return [];
  return adminUserIdsEnv
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * Check if a user ID is an admin
 */
export function isAdminUser(
  userId: string,
  adminUserIdsEnv: string | undefined
): boolean {
  const adminIds = getAdminUserIds(adminUserIdsEnv);
  return adminIds.includes(userId);
}

/**
 * Admin authentication result
 */
export interface AdminAuthResult {
  success: true;
  userId: string;
  isAdmin: true;
}

export interface AdminAuthError {
  success: false;
  error: string;
  code: string;
  status: 401 | 403;
}

export type AdminAuthResponse = AdminAuthResult | AdminAuthError;

/**
 * Validate admin authentication from request context
 *
 * This function checks:
 * 1. Session token exists and is valid
 * 2. User has admin privileges
 *
 * Use this in API routes and page server-side code.
 */
export async function validateAdminAuth(
  db: Database,
  cookieHeader: string | undefined,
  adminUserIdsEnv: string | undefined
): Promise<AdminAuthResponse> {
  const sessionToken = parseSessionCookie(cookieHeader || "");

  if (!sessionToken) {
    return {
      success: false,
      error: "Unauthorized",
      code: "UNAUTHORIZED",
      status: 401,
    };
  }

  const result = await validateSession(db, sessionToken);
  if (!result) {
    return {
      success: false,
      error: "Unauthorized",
      code: "UNAUTHORIZED",
      status: 401,
    };
  }

  // Check admin privileges
  if (!isAdminUser(result.user.id, adminUserIdsEnv)) {
    return {
      success: false,
      error: "Forbidden",
      code: "FORBIDDEN",
      status: 403,
    };
  }

  return {
    success: true,
    userId: result.user.id,
    isAdmin: true,
  };
}

/**
 * Validate CSRF token for mutation requests
 *
 * Returns null if valid, error object if invalid
 */
export function validateAdminCsrf(
  cookieHeader: string | undefined,
  csrfHeader: string | null | undefined
): { error: string; code: string } | null {
  const csrfCookie = parseCsrfCookie(cookieHeader || "");

  if (!validateCsrfToken(csrfCookie, csrfHeader ?? null)) {
    return {
      error: "Invalid CSRF token",
      code: "CSRF_VALIDATION_FAILED",
    };
  }

  return null;
}

/**
 * Check if a user is a protected admin (cannot be banned/suspended)
 */
export function isProtectedAdmin(
  targetUserId: string,
  adminUserIdsEnv: string | undefined
): boolean {
  return isAdminUser(targetUserId, adminUserIdsEnv);
}
