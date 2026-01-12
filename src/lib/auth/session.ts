/**
 * Session management for OAuth authentication
 *
 * Sessions are stored in the database with hashed tokens.
 * Cookie contains the raw token, DB stores SHA-256 hash.
 */

import { and, eq, gt, lt } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type * as schema from "../db/schema";
import { sessions, users } from "../db/schema";
import { generateSessionId, sha256Hash } from "./crypto";

// Session configuration
const SESSION_EXPIRES_DAYS = 14;

// Cookie configuration
export const SESSION_COOKIE_NAME = "__Host-session";
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * SESSION_EXPIRES_DAYS,
};

export type Database = LibSQLDatabase<typeof schema>;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
}

/**
 * Create a new session for a user
 *
 * Returns the raw session token (to be stored in cookie)
 * The hashed token is stored in the database
 */
export async function createSession(
  db: Database,
  userId: string
): Promise<{ token: string; session: Session }> {
  const token = generateSessionId();
  const hashedToken = await sha256Hash(token);

  const expiresAt = new Date(
    Date.now() + SESSION_EXPIRES_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const session: Session = {
    id: hashedToken,
    userId,
    expiresAt,
    createdAt: new Date().toISOString(),
  };

  await db.insert(sessions).values(session);

  return { token, session };
}

/**
 * Validate a session token and return the associated user
 *
 * Returns null if the session is invalid or expired
 */
export async function validateSession(
  db: Database,
  token: string
): Promise<{ session: Session; user: SessionUser } | null> {
  const hashedToken = await sha256Hash(token);
  const now = new Date().toISOString();

  const result = await db
    .select({
      session: sessions,
      user: {
        id: users.id,
        email: users.email,
        name: users.name,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.id, hashedToken),
        gt(sessions.expiresAt, now),
        // Exclude soft-deleted users
        eq(users.deletedAt, null as unknown as string)
      )
    )
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  return {
    session: result[0].session,
    user: result[0].user,
  };
}

/**
 * Invalidate (delete) a session
 */
export async function invalidateSession(
  db: Database,
  token: string
): Promise<void> {
  const hashedToken = await sha256Hash(token);
  await db.delete(sessions).where(eq(sessions.id, hashedToken));
}

/**
 * Invalidate all sessions for a user
 * Useful for "sign out everywhere" functionality
 */
export async function invalidateAllUserSessions(
  db: Database,
  userId: string
): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * Get all active sessions for a user
 * Returns sessions without the hashed token (for security)
 */
export async function getUserSessions(
  db: Database,
  userId: string
): Promise<Array<{ id: string; createdAt: string; expiresAt: string }>> {
  const now = new Date().toISOString();

  const result = await db
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, now)));

  return result;
}

/**
 * Delete a specific session by its hashed ID
 * Used for "sign out from this device" functionality
 */
export async function deleteSessionById(
  db: Database,
  sessionId: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));

  return result.rowsAffected > 0;
}

/**
 * Refresh a session's expiration time (sliding window)
 *
 * Only refreshes if the session has more than half its lifetime remaining
 * to avoid unnecessary database writes on every request
 */
export async function refreshSession(
  db: Database,
  token: string
): Promise<void> {
  const hashedToken = await sha256Hash(token);
  const now = new Date();

  // Check if session exists and get its expiration
  const existing = await db
    .select({ expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(eq(sessions.id, hashedToken))
    .limit(1);

  if (existing.length === 0) {
    return;
  }

  const expiresAt = new Date(existing[0].expiresAt);
  const halfLifetime = (SESSION_EXPIRES_DAYS * 24 * 60 * 60 * 1000) / 2;

  // Only refresh if more than half the lifetime has passed
  if (expiresAt.getTime() - now.getTime() < halfLifetime) {
    const newExpiresAt = new Date(
      now.getTime() + SESSION_EXPIRES_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    await db
      .update(sessions)
      .set({ expiresAt: newExpiresAt })
      .where(eq(sessions.id, hashedToken));
  }
}

/**
 * Clean up expired sessions
 * Should be called periodically (e.g., via scheduled worker)
 */
export async function cleanupExpiredSessions(db: Database): Promise<number> {
  const now = new Date().toISOString();
  const result = await db.delete(sessions).where(lt(sessions.expiresAt, now));
  return result.rowsAffected;
}

/**
 * Parse session token from cookie header
 */
export function parseSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.split("=");
    if (name === SESSION_COOKIE_NAME) {
      return valueParts.join("=") || null;
    }
  }

  return null;
}

/**
 * Create a Set-Cookie header value for the session
 */
export function createSessionCookie(token: string): string {
  const { httpOnly, secure, sameSite, path, maxAge } = SESSION_COOKIE_OPTIONS;
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    `Path=${path}`,
    `Max-Age=${maxAge}`,
    `SameSite=${sameSite}`,
  ];

  if (httpOnly) parts.push("HttpOnly");
  if (secure) parts.push("Secure");

  return parts.join("; ");
}

/**
 * Create a Set-Cookie header value to clear the session
 */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}
