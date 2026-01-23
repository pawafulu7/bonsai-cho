import { relations, sql } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { adminUsers } from "./admin";
import { users } from "./users";

/**
 * User status history table for audit logging.
 * Records all status changes (active, suspended, banned) for users.
 *
 * Privacy note: ipAddress stores masked/hashed values (e.g., "192.168.1.xxx:a1b2c3d4")
 * rather than raw IP addresses. Full IP is never persisted.
 */
export const userStatusHistory = sqliteTable(
  "user_status_history",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    previousStatus: text("previous_status").notNull(),
    newStatus: text("new_status").notNull(),
    reason: text("reason"),
    /** User who changed the status (for user-initiated changes) */
    changedBy: text("changed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Admin who changed the status (for admin-initiated changes) */
    adminChangedBy: text("admin_changed_by").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    changedAt: text("changed_at").notNull().default(sql`(datetime('now'))`),
    /** Stores masked IP + hash prefix for traceability (e.g., "192.168.1.xxx:a1b2c3d4") */
    ipAddress: text("ip_address"),
  },
  (table) => [
    // Composite index for efficient pagination queries (userId + changedAt + id)
    index("idx_user_status_history_user_changed").on(
      table.userId,
      table.changedAt,
      table.id
    ),
    index("idx_user_status_history_changed_at").on(table.changedAt),
  ]
);

export const userStatusHistoryRelations = relations(
  userStatusHistory,
  ({ one }) => ({
    user: one(users, {
      fields: [userStatusHistory.userId],
      references: [users.id],
    }),
    changedByUser: one(users, {
      fields: [userStatusHistory.changedBy],
      references: [users.id],
    }),
    adminChangedByUser: one(adminUsers, {
      fields: [userStatusHistory.adminChangedBy],
      references: [adminUsers.id],
    }),
  })
);

/**
 * User status type for type safety.
 */
export type UserStatus = "active" | "suspended" | "banned";

/**
 * Type for inserting a new status history record.
 */
export type NewUserStatusHistory = typeof userStatusHistory.$inferInsert;

/**
 * Type for selecting a status history record.
 */
export type UserStatusHistoryRecord = typeof userStatusHistory.$inferSelect;
