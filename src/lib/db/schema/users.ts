import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    location: text("location"),
    website: text("website"),
    followerCount: integer("follower_count").notNull().default(0),
    followingCount: integer("following_count").notNull().default(0),
    // Account status for moderation: "active" | "suspended" | "banned"
    status: text("status").notNull().default("active"),
    statusReason: text("status_reason"),
    statusChangedAt: text("status_changed_at"),
    statusChangedBy: text("status_changed_by"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    // Note: SQLite doesn't support auto-update timestamps.
    // Update paths must explicitly set updatedAt = new Date().toISOString()
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    index("idx_users_name").on(table.name),
    index("idx_users_created_at").on(table.createdAt),
    index("idx_users_deleted_at").on(table.deletedAt),
    index("idx_users_status").on(table.status),
  ]
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
}));

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_sessions_user_id").on(table.userId),
    index("idx_sessions_expires_at").on(table.expiresAt),
  ]
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));
