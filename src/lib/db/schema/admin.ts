/**
 * Admin Authentication Schema
 *
 * Separate authentication system for admin users.
 * Admin users are site operators who cannot post bonsai content.
 * This separation provides:
 * - Independent security controls (password + 2FA)
 * - Shorter session lifetimes (4 hours)
 * - No privilege escalation path from regular users
 * - Clear audit trail for admin actions
 */

import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Admin Users - Site operators with management privileges
 *
 * Security features:
 * - Password authentication with Argon2id hashing
 * - Optional TOTP 2FA support
 * - Account lockout after failed attempts
 * - IP and timestamp tracking for audit
 */
export const adminUsers = sqliteTable(
  "admin_users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    // Argon2id hash of password
    passwordHash: text("password_hash").notNull(),
    // TOTP 2FA fields
    totpSecret: text("totp_secret"), // Base32 encoded secret
    totpEnabled: integer("totp_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    // Account lockout fields
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: text("locked_until"), // ISO datetime when lockout expires
    // Audit fields
    lastLoginAt: text("last_login_at"),
    lastLoginIp: text("last_login_ip"),
    // Status: "active" | "disabled"
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_admin_users_email").on(table.email),
    index("idx_admin_users_status").on(table.status),
  ]
);

export const adminUsersRelations = relations(adminUsers, ({ many }) => ({
  sessions: many(adminSessions),
}));

/**
 * Admin Sessions - Short-lived sessions for admin users
 *
 * Security features:
 * - 4-hour session lifetime (vs 14 days for regular users)
 * - IP address and user agent tracking
 * - Cascade delete when admin user is deleted
 */
export const adminSessions = sqliteTable(
  "admin_sessions",
  {
    id: text("id").primaryKey(),
    adminUserId: text("admin_user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_admin_sessions_admin_user_id").on(table.adminUserId),
    index("idx_admin_sessions_expires_at").on(table.expiresAt),
  ]
);

export const adminSessionsRelations = relations(adminSessions, ({ one }) => ({
  adminUser: one(adminUsers, {
    fields: [adminSessions.adminUserId],
    references: [adminUsers.id],
  }),
}));

// Type exports
export type AdminUser = typeof adminUsers.$inferSelect;
export type NewAdminUser = typeof adminUsers.$inferInsert;
export type AdminSession = typeof adminSessions.$inferSelect;
export type NewAdminSession = typeof adminSessions.$inferInsert;
