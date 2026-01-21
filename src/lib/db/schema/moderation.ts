import { relations, sql } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./users";

/**
 * User status history table for audit logging.
 * Records all status changes (active, suspended, banned) for users.
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
    changedBy: text("changed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    changedAt: text("changed_at").notNull().default(sql`(datetime('now'))`),
    ipAddress: text("ip_address"),
  },
  (table) => [
    index("idx_user_status_history_user_id").on(table.userId),
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
