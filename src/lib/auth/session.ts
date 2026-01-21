/**
 * Session management for OAuth authentication
 *
 * Sessions are stored in the database with hashed tokens.
 * Cookie contains the raw token, DB stores SHA-256 hash.
 */

import { and, eq, gt, isNull, lt, or } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type * as schema from "../db/schema";
import {
  sessions,
  type UserStatus,
  userStatusHistory,
  users,
} from "../db/schema";
import { generateId, generateSessionId, sha256Hash } from "./crypto";

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

/**
 * Common interface for database operations that work in both
 * regular context and transaction context.
 * Used for functions that need to be called within transactions.
 */
type DbContext = Pick<Database, "delete">;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: UserStatus;
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
 * Returns null if the session is invalid, expired, or user is banned/suspended
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
        status: users.status,
      },
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.id, hashedToken),
        gt(sessions.expiresAt, now),
        // Exclude soft-deleted users
        isNull(users.deletedAt),
        // Only allow active users
        eq(users.status, "active")
      )
    )
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  return {
    session: result[0].session,
    user: result[0].user as SessionUser,
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
 *
 * @param dbOrTx - Database instance or transaction context
 */
export async function invalidateAllUserSessions(
  dbOrTx: DbContext,
  userId: string
): Promise<void> {
  await dbOrTx.delete(sessions).where(eq(sessions.userId, userId));
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
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=${SESSION_COOKIE_OPTIONS.sameSite}`;
}

// ============================================================================
// User Status Management (Ban/Suspend/Unban)
// ============================================================================

/**
 * Options for changing user status
 */
export interface ChangeUserStatusOptions {
  targetUserId: string;
  newStatus: UserStatus;
  reason?: string;
  changedByUserId?: string;
  ipAddress?: string;
}

/**
 * Change a user's status and record the change in history.
 * Also invalidates all sessions when banning or suspending.
 *
 * All operations are wrapped in a transaction to ensure atomicity.
 *
 * @returns The previous status of the user
 */
export async function changeUserStatus(
  db: Database,
  options: ChangeUserStatusOptions
): Promise<{ previousStatus: UserStatus; success: boolean }> {
  const { targetUserId, newStatus, reason, changedByUserId, ipAddress } =
    options;
  const now = new Date().toISOString();

  // Pre-compute IP hash outside transaction to avoid async issues
  let ipAddressHash: string | null = null;
  if (ipAddress) {
    const hash = await sha256Hash(ipAddress);
    // Store masked IP + hash prefix for traceability without full IP exposure
    const parts = ipAddress.split(".");
    if (parts.length === 4) {
      // IPv4: mask last octet, add hash prefix
      ipAddressHash = `${parts[0]}.${parts[1]}.${parts[2]}.xxx:${hash.substring(0, 8)}`;
    } else {
      // IPv6 or other: just store hash prefix
      ipAddressHash = `hash:${hash.substring(0, 16)}`;
    }
  }

  // Wrap all database operations in a transaction for atomicity
  return db.transaction(async (tx) => {
    // Get current user status
    const currentUser = await tx
      .select({ status: users.status })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (currentUser.length === 0) {
      return { previousStatus: "active" as UserStatus, success: false };
    }

    const previousStatus = currentUser[0].status as UserStatus;

    // Don't update if status is the same
    if (previousStatus === newStatus) {
      return { previousStatus, success: true };
    }

    // Update user status
    await tx
      .update(users)
      .set({
        status: newStatus,
        statusReason: reason ?? null,
        statusChangedAt: now,
        statusChangedBy: changedByUserId ?? null,
        updatedAt: now,
      })
      .where(eq(users.id, targetUserId));

    // Record status change in history
    await tx.insert(userStatusHistory).values({
      id: generateId(),
      userId: targetUserId,
      previousStatus,
      newStatus,
      reason: reason ?? null,
      changedBy: changedByUserId ?? null,
      changedAt: now,
      ipAddress: ipAddressHash,
    });

    // Invalidate all sessions when banning or suspending
    if (newStatus === "banned" || newStatus === "suspended") {
      await invalidateAllUserSessions(tx, targetUserId);
    }

    return { previousStatus, success: true };
  });
}

/**
 * Ban a user - permanently restricts access
 * Invalidates all active sessions immediately.
 */
export async function banUser(
  db: Database,
  targetUserId: string,
  reason?: string,
  changedByUserId?: string,
  ipAddress?: string
): Promise<{ previousStatus: UserStatus; success: boolean }> {
  return changeUserStatus(db, {
    targetUserId,
    newStatus: "banned",
    reason,
    changedByUserId,
    ipAddress,
  });
}

/**
 * Suspend a user - temporarily restricts access
 * Invalidates all active sessions immediately.
 */
export async function suspendUser(
  db: Database,
  targetUserId: string,
  reason?: string,
  changedByUserId?: string,
  ipAddress?: string
): Promise<{ previousStatus: UserStatus; success: boolean }> {
  return changeUserStatus(db, {
    targetUserId,
    newStatus: "suspended",
    reason,
    changedByUserId,
    ipAddress,
  });
}

/**
 * Unban/unsuspend a user - restores access
 */
export async function unbanUser(
  db: Database,
  targetUserId: string,
  reason?: string,
  changedByUserId?: string,
  ipAddress?: string
): Promise<{ previousStatus: UserStatus; success: boolean }> {
  return changeUserStatus(db, {
    targetUserId,
    newStatus: "active",
    reason,
    changedByUserId,
    ipAddress,
  });
}

/**
 * Options for paginated status history
 */
export interface GetStatusHistoryOptions {
  limit?: number; // Max 100, default 50
  cursor?: string; // ID of the last item from the previous page
}

/** Maximum allowed limit for status history pagination */
const MAX_STATUS_HISTORY_LIMIT = 100;

/**
 * Get a user's status change history with pagination
 */
export async function getUserStatusHistory(
  db: Database,
  userId: string,
  options: GetStatusHistoryOptions = {}
): Promise<{
  items: Array<{
    id: string;
    previousStatus: string;
    newStatus: string;
    reason: string | null;
    changedBy: string | null;
    changedAt: string;
    ipAddress: string | null;
  }>;
  nextCursor: string | null;
}> {
  // Cap limit at MAX_STATUS_HISTORY_LIMIT to prevent excessive data retrieval
  const limit = Math.min(options.limit ?? 50, MAX_STATUS_HISTORY_LIMIT);
  const fetchLimit = limit + 1; // Fetch one extra to determine if there's more

  let query = db
    .select({
      id: userStatusHistory.id,
      previousStatus: userStatusHistory.previousStatus,
      newStatus: userStatusHistory.newStatus,
      reason: userStatusHistory.reason,
      changedBy: userStatusHistory.changedBy,
      changedAt: userStatusHistory.changedAt,
      ipAddress: userStatusHistory.ipAddress,
    })
    .from(userStatusHistory)
    .where(eq(userStatusHistory.userId, userId))
    .orderBy(userStatusHistory.changedAt, userStatusHistory.id)
    .limit(fetchLimit);

  // If cursor is provided, we need to fetch items after that cursor
  // Uses composite cursor comparison for stability with same timestamps
  if (options.cursor) {
    // Get the changedAt for the cursor item, validate it belongs to the same user
    const cursorItem = await db
      .select({
        changedAt: userStatusHistory.changedAt,
        id: userStatusHistory.id,
      })
      .from(userStatusHistory)
      .where(
        and(
          eq(userStatusHistory.id, options.cursor),
          eq(userStatusHistory.userId, userId) // Prevent cross-user cursor access
        )
      )
      .limit(1);

    if (cursorItem.length > 0) {
      const cursorChangedAt = cursorItem[0].changedAt;
      const cursorId = cursorItem[0].id;

      query = db
        .select({
          id: userStatusHistory.id,
          previousStatus: userStatusHistory.previousStatus,
          newStatus: userStatusHistory.newStatus,
          reason: userStatusHistory.reason,
          changedBy: userStatusHistory.changedBy,
          changedAt: userStatusHistory.changedAt,
          ipAddress: userStatusHistory.ipAddress,
        })
        .from(userStatusHistory)
        .where(
          and(
            eq(userStatusHistory.userId, userId),
            // Composite comparison: (changedAt > cursor) OR (changedAt = cursor AND id > cursorId)
            or(
              gt(userStatusHistory.changedAt, cursorChangedAt),
              and(
                eq(userStatusHistory.changedAt, cursorChangedAt),
                gt(userStatusHistory.id, cursorId)
              )
            )
          )
        )
        .orderBy(userStatusHistory.changedAt, userStatusHistory.id)
        .limit(fetchLimit);
    }
  }

  const result = await query;

  // Check if there are more items
  const hasMore = result.length > limit;
  const items = hasMore ? result.slice(0, limit) : result;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return { items, nextCursor };
}

/**
 * Check if a user is banned or suspended (without validating session)
 * Useful for pre-login checks or admin views
 */
export async function getUserStatus(
  db: Database,
  userId: string
): Promise<UserStatus | null> {
  const result = await db
    .select({ status: users.status })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  return result[0].status as UserStatus;
}
