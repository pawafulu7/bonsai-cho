/**
 * Admin Session Management
 *
 * Separate authentication system for admin users with:
 * - Password-based authentication (PBKDF2)
 * - 4-hour session lifetime
 * - Account lockout protection
 * - IP/UserAgent tracking for audit
 *
 * Uses Web Crypto API for Cloudflare Workers compatibility.
 */

import { and, eq, gt, lt } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type * as schema from "../db/schema";
import { adminSessions, adminUsers } from "../db/schema";
import {
  base64urlDecode,
  base64urlEncode,
  generateId,
  generateSessionId,
  sha256Hash,
} from "./crypto";

// Session configuration - shorter lifetime for admin security
const ADMIN_SESSION_HOURS = 4;

// Account lockout configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

// Password hashing configuration (PBKDF2)
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEY_LENGTH = 32; // 256 bits
const SALT_LENGTH = 16; // 128 bits

// Cookie configuration for admin sessions
// __Host- prefix requires Path=/ (cannot be restricted to /manage)
export const ADMIN_SESSION_COOKIE_NAME = "__Host-admin_session";
export const ADMIN_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "strict" as const, // Stricter than regular sessions
  path: "/", // Required for __Host- prefix
  maxAge: 60 * 60 * ADMIN_SESSION_HOURS,
};

export type Database = LibSQLDatabase<typeof schema>;

export interface AdminSessionUser {
  id: string;
  email: string;
  name: string;
  status: string;
  totpEnabled: boolean;
}

export interface AdminSession {
  id: string;
  adminUserId: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

// ============================================================================
// Password Hashing (PBKDF2 via Web Crypto API)
// ============================================================================

/**
 * Hash a password using PBKDF2-SHA256
 * Returns: base64url(salt) + ":" + base64url(hash)
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    PBKDF2_KEY_LENGTH * 8
  );

  const saltBase64 = base64urlEncode(salt);
  const hashBase64 = base64urlEncode(new Uint8Array(hash));

  return `${saltBase64}:${hashBase64}`;
}

/**
 * Verify a password against a stored hash
 * Constant-time comparison to prevent timing attacks
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const [saltBase64, hashBase64] = storedHash.split(":");
  if (!saltBase64 || !hashBase64) {
    return false;
  }

  const encoder = new TextEncoder();
  const salt = base64urlDecode(saltBase64);
  const expectedHash = base64urlDecode(hashBase64);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const actualHash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    PBKDF2_KEY_LENGTH * 8
  );

  // Constant-time comparison
  const actualHashArray = new Uint8Array(actualHash);
  if (actualHashArray.length !== expectedHash.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < actualHashArray.length; i++) {
    result |= actualHashArray[i] ^ expectedHash[i];
  }

  return result === 0;
}

// ============================================================================
// Admin Session Management
// ============================================================================

/**
 * Authenticate an admin user with email and password
 *
 * Returns the admin user if authentication succeeds, null otherwise.
 * Updates login attempt tracking and handles account lockout.
 */
export async function authenticateAdmin(
  db: Database,
  email: string,
  password: string,
  ipAddress?: string
): Promise<{
  success: boolean;
  user?: AdminSessionUser;
  error?: "INVALID_CREDENTIALS" | "ACCOUNT_LOCKED" | "ACCOUNT_DISABLED";
  lockoutRemaining?: number; // minutes
}> {
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date().toISOString();

  // Find admin user
  const adminUserResult = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, normalizedEmail))
    .limit(1);

  if (adminUserResult.length === 0) {
    // User not found - return generic error to prevent enumeration
    return { success: false, error: "INVALID_CREDENTIALS" };
  }

  const adminUser = adminUserResult[0];

  // Check if account is disabled
  if (adminUser.status === "disabled") {
    return { success: false, error: "ACCOUNT_DISABLED" };
  }

  // Check if account is locked
  if (adminUser.lockedUntil && adminUser.lockedUntil > now) {
    const lockoutEnd = new Date(adminUser.lockedUntil);
    const remaining = Math.ceil(
      (lockoutEnd.getTime() - Date.now()) / (60 * 1000)
    );
    return {
      success: false,
      error: "ACCOUNT_LOCKED",
      lockoutRemaining: remaining,
    };
  }

  // Verify password
  const passwordValid = await verifyPassword(password, adminUser.passwordHash);

  if (!passwordValid) {
    // Increment failed attempts
    const newFailedAttempts = adminUser.failedLoginAttempts + 1;
    const shouldLock = newFailedAttempts >= MAX_FAILED_ATTEMPTS;

    const lockoutExpiry = shouldLock
      ? new Date(
          Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000
        ).toISOString()
      : null;

    await db
      .update(adminUsers)
      .set({
        failedLoginAttempts: newFailedAttempts,
        lockedUntil: lockoutExpiry,
        updatedAt: now,
      })
      .where(eq(adminUsers.id, adminUser.id));

    if (shouldLock) {
      return {
        success: false,
        error: "ACCOUNT_LOCKED",
        lockoutRemaining: LOCKOUT_DURATION_MINUTES,
      };
    }

    return { success: false, error: "INVALID_CREDENTIALS" };
  }

  // Password is valid - reset failed attempts and update last login
  await db
    .update(adminUsers)
    .set({
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: now,
      lastLoginIp: ipAddress || null,
      updatedAt: now,
    })
    .where(eq(adminUsers.id, adminUser.id));

  return {
    success: true,
    user: {
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      status: adminUser.status,
      totpEnabled: adminUser.totpEnabled,
    },
  };
}

/**
 * Create a new admin session
 *
 * Returns the raw session token (to be stored in cookie)
 * The hashed token is stored in the database
 */
export async function createAdminSession(
  db: Database,
  adminUserId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ token: string; session: AdminSession }> {
  const token = generateSessionId();
  const hashedToken = await sha256Hash(token);

  const expiresAt = new Date(
    Date.now() + ADMIN_SESSION_HOURS * 60 * 60 * 1000
  ).toISOString();

  const session: AdminSession = {
    id: hashedToken,
    adminUserId,
    expiresAt,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
    createdAt: new Date().toISOString(),
  };

  await db.insert(adminSessions).values(session);

  return { token, session };
}

/**
 * Validate an admin session token and return the associated admin user
 *
 * Returns null if the session is invalid, expired, or user is disabled
 */
export async function validateAdminSession(
  db: Database,
  token: string
): Promise<{ session: AdminSession; user: AdminSessionUser } | null> {
  const hashedToken = await sha256Hash(token);
  const now = new Date().toISOString();

  const result = await db
    .select({
      session: adminSessions,
      user: {
        id: adminUsers.id,
        email: adminUsers.email,
        name: adminUsers.name,
        status: adminUsers.status,
        totpEnabled: adminUsers.totpEnabled,
      },
    })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminSessions.adminUserId, adminUsers.id))
    .where(
      and(
        eq(adminSessions.id, hashedToken),
        gt(adminSessions.expiresAt, now),
        eq(adminUsers.status, "active")
      )
    )
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  return {
    session: result[0].session,
    user: result[0].user as AdminSessionUser,
  };
}

/**
 * Invalidate (delete) an admin session
 */
export async function invalidateAdminSession(
  db: Database,
  token: string
): Promise<void> {
  const hashedToken = await sha256Hash(token);
  await db.delete(adminSessions).where(eq(adminSessions.id, hashedToken));
}

/**
 * Invalidate all sessions for an admin user
 */
export async function invalidateAllAdminSessions(
  db: Database,
  adminUserId: string
): Promise<void> {
  await db
    .delete(adminSessions)
    .where(eq(adminSessions.adminUserId, adminUserId));
}

/**
 * Clean up expired admin sessions
 */
export async function cleanupExpiredAdminSessions(
  db: Database
): Promise<number> {
  const now = new Date().toISOString();
  const result = await db
    .delete(adminSessions)
    .where(lt(adminSessions.expiresAt, now));
  return result.rowsAffected;
}

// ============================================================================
// Cookie Helpers
// ============================================================================

/**
 * Parse admin session token from cookie header
 */
export function parseAdminSessionCookie(
  cookieHeader: string | null
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.split("=");
    if (name === ADMIN_SESSION_COOKIE_NAME) {
      return valueParts.join("=") || null;
    }
  }

  return null;
}

/**
 * Create a Set-Cookie header value for the admin session
 */
export function createAdminSessionCookie(token: string): string {
  const { httpOnly, secure, sameSite, path, maxAge } =
    ADMIN_SESSION_COOKIE_OPTIONS;
  const parts = [
    `${ADMIN_SESSION_COOKIE_NAME}=${token}`,
    `Path=${path}`,
    `Max-Age=${maxAge}`,
    `SameSite=${sameSite}`,
  ];

  if (httpOnly) parts.push("HttpOnly");
  if (secure) parts.push("Secure");

  return parts.join("; ");
}

/**
 * Create a Set-Cookie header value to clear the admin session
 */
export function clearAdminSessionCookie(): string {
  return `${ADMIN_SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=strict`;
}

// ============================================================================
// Admin User Management
// ============================================================================

/**
 * Create a new admin user
 */
export async function createAdminUser(
  db: Database,
  email: string,
  name: string,
  password: string
): Promise<{ id: string; email: string; name: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const passwordHash = await hashPassword(password);
  const id = generateId();

  await db.insert(adminUsers).values({
    id,
    email: normalizedEmail,
    name,
    passwordHash,
  });

  return { id, email: normalizedEmail, name };
}

/**
 * Change an admin user's password
 */
export async function changeAdminPassword(
  db: Database,
  adminUserId: string,
  newPassword: string
): Promise<void> {
  const passwordHash = await hashPassword(newPassword);
  const now = new Date().toISOString();

  await db
    .update(adminUsers)
    .set({
      passwordHash,
      updatedAt: now,
    })
    .where(eq(adminUsers.id, adminUserId));

  // Invalidate all existing sessions for security
  await invalidateAllAdminSessions(db, adminUserId);
}

/**
 * Get an admin user by email
 */
export async function getAdminUserByEmail(
  db: Database,
  email: string
): Promise<AdminSessionUser | null> {
  const normalizedEmail = email.toLowerCase().trim();

  const result = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      name: adminUsers.name,
      status: adminUsers.status,
      totpEnabled: adminUsers.totpEnabled,
    })
    .from(adminUsers)
    .where(eq(adminUsers.email, normalizedEmail))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  return result[0];
}
