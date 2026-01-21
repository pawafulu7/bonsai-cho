/**
 * System Settings and Audit Log Schema
 *
 * Stores application settings and records admin actions for audit purposes.
 */

import { relations, sql } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./users";

/**
 * System Settings Table
 *
 * Key-value store for application settings.
 * Supported keys:
 * - registration_enabled: "true" | "false" - Whether new user registration is allowed
 * - maintenance_mode: "true" | "false" - Whether the site is in maintenance mode
 * - maintenance_message: string - Message to display during maintenance
 */
export const systemSettings = sqliteTable(
  "system_settings",
  {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
    description: text("description"),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
    updatedBy: text("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [index("idx_system_settings_updated_at").on(table.updatedAt)]
);

export const systemSettingsRelations = relations(systemSettings, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [systemSettings.updatedBy],
    references: [users.id],
  }),
}));

/**
 * Audit Log Table
 *
 * Records admin actions for compliance and debugging.
 */
export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    // Actor information (nullable to preserve logs when user is deleted)
    actorId: text("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorIp: text("actor_ip"),
    // Action details
    action: text("action", {
      enum: [
        "user.ban",
        "user.suspend",
        "user.unban",
        "settings.update",
        "admin.login",
      ],
    }).notNull(),
    // Target resource (if applicable)
    targetType: text("target_type", {
      enum: ["user", "setting", "session"],
    }),
    targetId: text("target_id"),
    // Additional details as JSON
    details: text("details"),
    // Timestamp
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_audit_logs_actor").on(table.actorId),
    index("idx_audit_logs_action").on(table.action),
    index("idx_audit_logs_target").on(table.targetType, table.targetId),
    index("idx_audit_logs_created_at").on(table.createdAt),
  ]
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorId],
    references: [users.id],
  }),
}));

// Type exports
export type SystemSetting = typeof systemSettings.$inferSelect;
export type NewSystemSetting = typeof systemSettings.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type AuditAction = AuditLog["action"];
export type AuditTargetType = AuditLog["targetType"];
