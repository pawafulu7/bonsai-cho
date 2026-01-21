/**
 * Session management unit tests
 *
 * Tests for session creation, validation, and cookie handling.
 * Uses mock database for DB-dependent functions.
 */

import { describe, expect, it, vi } from "vitest";
import type { Database } from "./session";
import {
  clearSessionCookie,
  createSessionCookie,
  parseSessionCookie,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from "./session";

describe("session", () => {
  describe("parseSessionCookie", () => {
    it("should parse single session cookie", () => {
      const token = "test-session-token-12345";
      const cookieHeader = `${SESSION_COOKIE_NAME}=${token}`;

      expect(parseSessionCookie(cookieHeader)).toBe(token);
    });

    it("should parse session cookie from multiple cookies", () => {
      const token = "session-token-value";
      const cookieHeader = `other=value; ${SESSION_COOKIE_NAME}=${token}; another=data`;

      expect(parseSessionCookie(cookieHeader)).toBe(token);
    });

    it("should handle cookie value containing equals sign", () => {
      // Base64url tokens might have been padded before
      const token = "abc=def=ghi";
      const cookieHeader = `${SESSION_COOKIE_NAME}=${token}`;

      expect(parseSessionCookie(cookieHeader)).toBe(token);
    });

    it("should return null for empty cookie header", () => {
      expect(parseSessionCookie("")).toBeNull();
    });

    it("should return null for null cookie header", () => {
      expect(parseSessionCookie(null)).toBeNull();
    });

    it("should return null when session cookie not present", () => {
      const cookieHeader = "other=value; another=data";

      expect(parseSessionCookie(cookieHeader)).toBeNull();
    });

    it("should handle whitespace in cookie header", () => {
      const token = "token-value";
      const cookieHeader = `  ${SESSION_COOKIE_NAME}=${token}  ;  other=value  `;

      expect(parseSessionCookie(cookieHeader)).toBe(token);
    });
  });

  describe("createSessionCookie", () => {
    it("should create valid Set-Cookie header value", () => {
      const token = "test-session-token";
      const cookie = createSessionCookie(token);

      expect(cookie).toContain(`${SESSION_COOKIE_NAME}=${token}`);
      expect(cookie).toContain("Path=/");
      expect(cookie).toContain(`Max-Age=${SESSION_COOKIE_OPTIONS.maxAge}`);
      expect(cookie.toLowerCase()).toContain("samesite=lax");
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("HttpOnly");
    });

    it("should include HttpOnly flag for security", () => {
      const cookie = createSessionCookie("token");

      expect(cookie).toContain("HttpOnly");
    });
  });

  describe("clearSessionCookie", () => {
    it("should create cookie with Max-Age=0", () => {
      const cookie = clearSessionCookie();

      expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`);
      expect(cookie).toContain("Max-Age=0");
      expect(cookie).toContain("Path=/");
      expect(cookie).toContain("Secure");
      expect(cookie.toLowerCase()).toContain("samesite=lax");
      expect(cookie).toContain("HttpOnly");
    });
  });

  describe("constants", () => {
    it("should have correct cookie name with __Host- prefix", () => {
      expect(SESSION_COOKIE_NAME).toBe("__Host-session");
    });

    it("should have correct cookie options", () => {
      expect(SESSION_COOKIE_OPTIONS.httpOnly).toBe(true);
      expect(SESSION_COOKIE_OPTIONS.secure).toBe(true);
      expect(SESSION_COOKIE_OPTIONS.sameSite).toBe("lax");
      expect(SESSION_COOKIE_OPTIONS.path).toBe("/");
      // 14 days in seconds
      expect(SESSION_COOKIE_OPTIONS.maxAge).toBe(60 * 60 * 24 * 14);
    });
  });

  /**
   * DB-dependent function tests using mocks
   *
   * These tests verify the session management logic works correctly
   * with mocked database operations.
   *
   * Note: We use `as unknown as Database` pattern for mock objects
   * since creating fully typed mocks for Drizzle ORM is complex.
   */
  describe("DB-dependent functions", () => {
    // Import session functions that depend on DB
    // We use dynamic import to allow module-level mocking if needed

    describe("createSession", () => {
      it("should generate unique token and hash for storage", async () => {
        const { sha256Hash } = await import("./crypto");
        const { createSession } = await import("./session");

        // Create a mock database
        const insertValues = vi.fn().mockResolvedValue(undefined);
        const mockDb = {
          insert: vi.fn().mockReturnValue({
            values: insertValues,
          }),
        } as unknown as Database;

        const result = await createSession(mockDb, "user-123");

        // Verify token is generated
        expect(result.token).toBeDefined();
        expect(result.token.length).toBe(43); // 32 bytes base64url

        // Verify session object
        expect(result.session.userId).toBe("user-123");
        expect(result.session.id).toBeDefined();
        expect(result.session.expiresAt).toBeDefined();
        expect(result.session.createdAt).toBeDefined();

        // Verify the stored ID is the hash of the token
        const expectedHash = await sha256Hash(result.token);
        expect(result.session.id).toBe(expectedHash);

        // Verify database insert was called
        expect(
          (mockDb as unknown as { insert: ReturnType<typeof vi.fn> }).insert
        ).toHaveBeenCalled();
        expect(insertValues).toHaveBeenCalledWith(result.session);
      });

      it("should set expiration 14 days in the future", async () => {
        const { createSession } = await import("./session");

        const mockDb = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined),
          }),
        } as unknown as Database;

        const before = Date.now();
        const result = await createSession(mockDb, "user-123");
        const after = Date.now();

        const expiresAt = new Date(result.session.expiresAt).getTime();
        const expectedMin = before + 14 * 24 * 60 * 60 * 1000;
        const expectedMax = after + 14 * 24 * 60 * 60 * 1000;

        expect(expiresAt).toBeGreaterThanOrEqual(expectedMin);
        expect(expiresAt).toBeLessThanOrEqual(expectedMax);
      });
    });

    describe("validateSession", () => {
      it("should return user and session for valid token", async () => {
        const { sha256Hash } = await import("./crypto");
        const { validateSession } = await import("./session");

        const token = "valid-token-12345678901234567890123456789012";
        const hashedToken = await sha256Hash(token);
        const futureDate = new Date(Date.now() + 86400000).toISOString();

        const mockUser = {
          id: "user-123",
          email: "test@example.com",
          name: "Test User",
          displayName: "Test",
          avatarUrl: null,
        };

        const mockSession = {
          id: hashedToken,
          userId: "user-123",
          expiresAt: futureDate,
          createdAt: new Date().toISOString(),
        };

        const mockDb = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([
                    {
                      session: mockSession,
                      user: mockUser,
                    },
                  ]),
                }),
              }),
            }),
          }),
        } as unknown as Database;

        const result = await validateSession(mockDb, token);

        expect(result).not.toBeNull();
        expect(result?.user).toEqual(mockUser);
        expect(result?.session).toEqual(mockSession);
      });

      it("should return null for invalid token", async () => {
        const { validateSession } = await import("./session");

        const mockDb = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        } as unknown as Database;

        const result = await validateSession(mockDb, "invalid-token");

        expect(result).toBeNull();
      });
    });

    describe("invalidateSession", () => {
      it("should delete session by hashed token", async () => {
        const { invalidateSession } = await import("./session");

        const token = "token-to-invalidate-123456789012345678901";

        const deleteMock = vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
        });

        const mockDb = {
          delete: deleteMock,
        } as unknown as Database;

        await invalidateSession(mockDb, token);

        expect(deleteMock).toHaveBeenCalled();
      });
    });

    describe("invalidateAllUserSessions", () => {
      it("should delete all sessions for a user", async () => {
        const { invalidateAllUserSessions } = await import("./session");

        const deleteMock = vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowsAffected: 3 }),
        });

        const mockDb = {
          delete: deleteMock,
        } as unknown as Database;

        await invalidateAllUserSessions(mockDb, "user-123");

        expect(deleteMock).toHaveBeenCalled();
      });
    });

    describe("deleteSessionById", () => {
      it("should return true when session is deleted", async () => {
        const { deleteSessionById } = await import("./session");

        const mockDb = {
          delete: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
          }),
        } as unknown as Database;

        const result = await deleteSessionById(
          mockDb,
          "session-id",
          "user-123"
        );

        expect(result).toBe(true);
      });

      it("should return false when session not found", async () => {
        const { deleteSessionById } = await import("./session");

        const mockDb = {
          delete: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
          }),
        } as unknown as Database;

        const result = await deleteSessionById(
          mockDb,
          "nonexistent",
          "user-123"
        );

        expect(result).toBe(false);
      });
    });

    describe("refreshSession", () => {
      it("should not update session when more than half lifetime remaining", async () => {
        const { refreshSession } = await import("./session");

        const token = "refresh-token-123456789012345678901234";

        // Session expires in 10 days (more than 7 days = half of 14)
        const futureDate = new Date(
          Date.now() + 10 * 24 * 60 * 60 * 1000
        ).toISOString();

        const selectMock = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ expiresAt: futureDate }]),
            }),
          }),
        });

        const updateMock = vi.fn();

        const mockDb = {
          select: selectMock,
          update: updateMock,
        } as unknown as Database;

        await refreshSession(mockDb, token);

        // Update should NOT be called since > half lifetime remaining
        expect(updateMock).not.toHaveBeenCalled();
      });

      it("should update session when less than half lifetime remaining", async () => {
        const { refreshSession } = await import("./session");

        const token = "refresh-token-123456789012345678901234";

        // Session expires in 5 days (less than 7 days = half of 14)
        const futureDate = new Date(
          Date.now() + 5 * 24 * 60 * 60 * 1000
        ).toISOString();

        const selectMock = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ expiresAt: futureDate }]),
            }),
          }),
        });

        const setMock = vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
        });

        const updateMock = vi.fn().mockReturnValue({
          set: setMock,
        });

        const mockDb = {
          select: selectMock,
          update: updateMock,
        } as unknown as Database;

        await refreshSession(mockDb, token);

        // Update should be called since < half lifetime remaining
        expect(updateMock).toHaveBeenCalled();
        expect(setMock).toHaveBeenCalled();
      });

      it("should do nothing if session not found", async () => {
        const { refreshSession } = await import("./session");

        const selectMock = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

        const updateMock = vi.fn();

        const mockDb = {
          select: selectMock,
          update: updateMock,
        } as unknown as Database;

        await refreshSession(mockDb, "nonexistent-token");

        expect(updateMock).not.toHaveBeenCalled();
      });
    });

    describe("cleanupExpiredSessions", () => {
      it("should return number of deleted sessions", async () => {
        const { cleanupExpiredSessions } = await import("./session");

        const mockDb = {
          delete: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({ rowsAffected: 5 }),
          }),
        } as unknown as Database;

        const result = await cleanupExpiredSessions(mockDb);

        expect(result).toBe(5);
      });
    });

    describe("getUserSessions", () => {
      it("should return active sessions for user", async () => {
        const { getUserSessions } = await import("./session");

        const mockSessions = [
          {
            id: "session-1",
            createdAt: "2024-01-01T00:00:00Z",
            expiresAt: "2024-01-15T00:00:00Z",
          },
          {
            id: "session-2",
            createdAt: "2024-01-02T00:00:00Z",
            expiresAt: "2024-01-16T00:00:00Z",
          },
        ];

        const mockDb = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockSessions),
            }),
          }),
        } as unknown as Database;

        const result = await getUserSessions(mockDb, "user-123");

        expect(result).toEqual(mockSessions);
        expect(result.length).toBe(2);
      });

      it("should return empty array when no sessions", async () => {
        const { getUserSessions } = await import("./session");

        const mockDb = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as unknown as Database;

        const result = await getUserSessions(mockDb, "user-with-no-sessions");

        expect(result).toEqual([]);
      });
    });

    // ========================================================================
    // User Status Management Tests
    // ========================================================================

    describe("changeUserStatus", () => {
      it("should change user status and record history", async () => {
        const { changeUserStatus } = await import("./session");

        const selectMock = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ status: "active" }]),
            }),
          }),
        });

        const updateMock = vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
          }),
        });

        const insertMock = vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        });

        const deleteMock = vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
        });

        const mockDb = {
          select: selectMock,
          update: updateMock,
          insert: insertMock,
          delete: deleteMock,
        } as unknown as Database;

        const result = await changeUserStatus(mockDb, {
          targetUserId: "user-123",
          newStatus: "banned",
          reason: "Spam",
          changedByUserId: "admin-456",
          ipAddress: "192.168.1.1",
        });

        expect(result.previousStatus).toBe("active");
        expect(result.success).toBe(true);
        expect(updateMock).toHaveBeenCalled();
        expect(insertMock).toHaveBeenCalled();
        // Sessions should be invalidated on ban
        expect(deleteMock).toHaveBeenCalled();
      });

      it("should not update if status is same", async () => {
        const { changeUserStatus } = await import("./session");

        const selectMock = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ status: "banned" }]),
            }),
          }),
        });

        const updateMock = vi.fn();

        const mockDb = {
          select: selectMock,
          update: updateMock,
        } as unknown as Database;

        const result = await changeUserStatus(mockDb, {
          targetUserId: "user-123",
          newStatus: "banned",
        });

        expect(result.previousStatus).toBe("banned");
        expect(result.success).toBe(true);
        expect(updateMock).not.toHaveBeenCalled();
      });

      it("should return failure if user not found", async () => {
        const { changeUserStatus } = await import("./session");

        const selectMock = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

        const mockDb = {
          select: selectMock,
        } as unknown as Database;

        const result = await changeUserStatus(mockDb, {
          targetUserId: "nonexistent",
          newStatus: "banned",
        });

        expect(result.success).toBe(false);
      });
    });

    describe("banUser", () => {
      it("should call changeUserStatus with banned status", async () => {
        const { banUser } = await import("./session");

        const selectMock = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ status: "active" }]),
            }),
          }),
        });

        const updateMock = vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
          }),
        });

        const insertMock = vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        });

        const deleteMock = vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
        });

        const mockDb = {
          select: selectMock,
          update: updateMock,
          insert: insertMock,
          delete: deleteMock,
        } as unknown as Database;

        const result = await banUser(mockDb, "user-123", "Spam", "admin-456");

        expect(result.previousStatus).toBe("active");
        expect(result.success).toBe(true);
      });
    });

    describe("suspendUser", () => {
      it("should call changeUserStatus with suspended status", async () => {
        const { suspendUser } = await import("./session");

        const selectMock = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ status: "active" }]),
            }),
          }),
        });

        const updateMock = vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
          }),
        });

        const insertMock = vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        });

        const deleteMock = vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
        });

        const mockDb = {
          select: selectMock,
          update: updateMock,
          insert: insertMock,
          delete: deleteMock,
        } as unknown as Database;

        const result = await suspendUser(
          mockDb,
          "user-123",
          "Temporary issue",
          "admin-456"
        );

        expect(result.previousStatus).toBe("active");
        expect(result.success).toBe(true);
      });
    });

    describe("unbanUser", () => {
      it("should restore user to active status", async () => {
        const { unbanUser } = await import("./session");

        const selectMock = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ status: "banned" }]),
            }),
          }),
        });

        const updateMock = vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
          }),
        });

        const insertMock = vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        });

        const mockDb = {
          select: selectMock,
          update: updateMock,
          insert: insertMock,
        } as unknown as Database;

        const result = await unbanUser(mockDb, "user-123", "Appeal accepted");

        expect(result.previousStatus).toBe("banned");
        expect(result.success).toBe(true);
      });

      it("should not invalidate sessions when unbanning", async () => {
        const { unbanUser } = await import("./session");

        const selectMock = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ status: "suspended" }]),
            }),
          }),
        });

        const updateMock = vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
          }),
        });

        const insertMock = vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        });

        const deleteMock = vi.fn();

        const mockDb = {
          select: selectMock,
          update: updateMock,
          insert: insertMock,
          delete: deleteMock,
        } as unknown as Database;

        await unbanUser(mockDb, "user-123");

        // Delete should NOT be called when unbanning
        expect(deleteMock).not.toHaveBeenCalled();
      });
    });

    describe("getUserStatusHistory", () => {
      it("should return status change history with pagination", async () => {
        const { getUserStatusHistory } = await import("./session");

        const mockHistory = [
          {
            id: "history-1",
            previousStatus: "active",
            newStatus: "banned",
            reason: "Spam",
            changedBy: "admin-123",
            changedAt: "2024-01-01T00:00:00Z",
            ipAddress: "192.168.1.1",
          },
          {
            id: "history-2",
            previousStatus: "banned",
            newStatus: "active",
            reason: "Appeal accepted",
            changedBy: "admin-123",
            changedAt: "2024-01-02T00:00:00Z",
            ipAddress: "192.168.1.1",
          },
        ];

        const selectMock = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(mockHistory),
              }),
            }),
          }),
        });

        const mockDb = {
          select: selectMock,
        } as unknown as Database;

        const result = await getUserStatusHistory(mockDb, "user-123");

        expect(result.items).toEqual(mockHistory);
        expect(result.items.length).toBe(2);
        expect(result.nextCursor).toBeNull();
      });

      it("should return empty items for user with no history", async () => {
        const { getUserStatusHistory } = await import("./session");

        const selectMock = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        });

        const mockDb = {
          select: selectMock,
        } as unknown as Database;

        const result = await getUserStatusHistory(mockDb, "new-user");

        expect(result.items).toEqual([]);
        expect(result.nextCursor).toBeNull();
      });

      it("should return nextCursor when more items exist", async () => {
        const { getUserStatusHistory } = await import("./session");

        // Mock returns 3 items when limit is 2 (fetchLimit = limit + 1)
        const mockHistory = [
          {
            id: "history-1",
            previousStatus: "active",
            newStatus: "banned",
            reason: "Spam",
            changedBy: "admin-123",
            changedAt: "2024-01-01T00:00:00Z",
            ipAddress: "192.168.1.1",
          },
          {
            id: "history-2",
            previousStatus: "banned",
            newStatus: "active",
            reason: "Appeal accepted",
            changedBy: "admin-123",
            changedAt: "2024-01-02T00:00:00Z",
            ipAddress: "192.168.1.1",
          },
          {
            id: "history-3",
            previousStatus: "active",
            newStatus: "suspended",
            reason: "Violation",
            changedBy: "admin-123",
            changedAt: "2024-01-03T00:00:00Z",
            ipAddress: "192.168.1.1",
          },
        ];

        const selectMock = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(mockHistory),
              }),
            }),
          }),
        });

        const mockDb = {
          select: selectMock,
        } as unknown as Database;

        const result = await getUserStatusHistory(mockDb, "user-123", {
          limit: 2,
        });

        expect(result.items.length).toBe(2);
        expect(result.nextCursor).toBe("history-2");
      });
    });

    describe("getUserStatus", () => {
      it("should return user status", async () => {
        const { getUserStatus } = await import("./session");

        const selectMock = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ status: "banned" }]),
            }),
          }),
        });

        const mockDb = {
          select: selectMock,
        } as unknown as Database;

        const result = await getUserStatus(mockDb, "user-123");

        expect(result).toBe("banned");
      });

      it("should return null for nonexistent user", async () => {
        const { getUserStatus } = await import("./session");

        const selectMock = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

        const mockDb = {
          select: selectMock,
        } as unknown as Database;

        const result = await getUserStatus(mockDb, "nonexistent");

        expect(result).toBeNull();
      });
    });
  });
});
