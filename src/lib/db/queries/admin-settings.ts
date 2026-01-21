/**
 * Admin Settings Queries
 *
 * Provides settings management and audit logging functionality.
 */

import { desc, eq, sql } from "drizzle-orm";
import { generateId } from "@/lib/auth/crypto";
import type { Database } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

// Default settings
export const DEFAULT_SETTINGS: Record<
  string,
  { value: string; description: string }
> = {
  registration_enabled: {
    value: "true",
    description: "新規ユーザー登録の許可",
  },
  maintenance_mode: {
    value: "false",
    description: "メンテナンスモード",
  },
  maintenance_message: {
    value: "現在メンテナンス中です。しばらくお待ちください。",
    description: "メンテナンス時に表示するメッセージ",
  },
};

export type SettingKey = keyof typeof DEFAULT_SETTINGS;

export interface SettingItem {
  key: string;
  value: string;
  description: string | null;
  updatedAt: string;
  updatedBy: string | null;
  updatedByName: string | null;
}

/**
 * Get all system settings
 */
export async function getAllSettings(db: Database): Promise<SettingItem[]> {
  const existingSettings = await db
    .select({
      key: schema.systemSettings.key,
      value: schema.systemSettings.value,
      description: schema.systemSettings.description,
      updatedAt: schema.systemSettings.updatedAt,
      updatedBy: schema.systemSettings.updatedBy,
      updatedByName: schema.users.name,
    })
    .from(schema.systemSettings)
    .leftJoin(
      schema.users,
      eq(schema.systemSettings.updatedBy, schema.users.id)
    );

  // Merge with default settings to ensure all keys are present
  const settingsMap = new Map(existingSettings.map((s) => [s.key, s]));
  const result: SettingItem[] = [];

  for (const [key, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = settingsMap.get(key);
    if (existing) {
      result.push({
        key: existing.key,
        value: existing.value,
        description: existing.description || defaultValue.description,
        updatedAt: existing.updatedAt,
        updatedBy: existing.updatedBy,
        updatedByName: existing.updatedByName,
      });
    } else {
      result.push({
        key,
        value: defaultValue.value,
        description: defaultValue.description,
        updatedAt: new Date().toISOString(),
        updatedBy: null,
        updatedByName: null,
      });
    }
  }

  return result;
}

/**
 * Get a single setting value
 */
export async function getSetting(
  db: Database,
  key: string
): Promise<string | null> {
  const [setting] = await db
    .select({ value: schema.systemSettings.value })
    .from(schema.systemSettings)
    .where(eq(schema.systemSettings.key, key))
    .limit(1);

  if (setting) {
    return setting.value;
  }

  // Return default value if available
  return DEFAULT_SETTINGS[key as SettingKey]?.value || null;
}

/**
 * Update a setting value
 */
export async function updateSetting(
  db: Database,
  key: string,
  value: string,
  adminUserId: string,
  ipAddress: string | null
): Promise<{ success: boolean; previousValue: string | null }> {
  const previousValue = await getSetting(db, key);
  const now = new Date().toISOString();

  // Upsert the setting
  await db
    .insert(schema.systemSettings)
    .values({
      key,
      value,
      description: DEFAULT_SETTINGS[key as SettingKey]?.description || null,
      updatedAt: now,
      updatedBy: adminUserId,
    })
    .onConflictDoUpdate({
      target: schema.systemSettings.key,
      set: {
        value,
        updatedAt: now,
        updatedBy: adminUserId,
      },
    });

  // Create audit log
  await db.insert(schema.auditLogs).values({
    id: generateId(),
    actorId: adminUserId,
    actorIp: ipAddress,
    action: "settings.update",
    targetType: "setting",
    targetId: key,
    details: JSON.stringify({
      previousValue,
      newValue: value,
    }),
  });

  return { success: true, previousValue };
}

/**
 * Check if registration is enabled
 */
export async function isRegistrationEnabled(db: Database): Promise<boolean> {
  const value = await getSetting(db, "registration_enabled");
  return value === "true";
}

/**
 * Check if maintenance mode is enabled
 */
export async function isMaintenanceModeEnabled(db: Database): Promise<boolean> {
  const value = await getSetting(db, "maintenance_mode");
  return value === "true";
}

export interface AuditLogItem {
  id: string;
  actorId: string;
  actorName: string | null;
  actorIp: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: string | null;
  createdAt: string;
}

/**
 * Get recent audit logs
 */
export async function getAuditLogs(
  db: Database,
  options: { limit?: number; offset?: number } = {}
): Promise<{ logs: AuditLogItem[]; total: number }> {
  const { limit = 50, offset = 0 } = options;

  const logs = await db
    .select({
      id: schema.auditLogs.id,
      actorId: schema.auditLogs.actorId,
      actorName: schema.users.name,
      actorIp: schema.auditLogs.actorIp,
      action: schema.auditLogs.action,
      targetType: schema.auditLogs.targetType,
      targetId: schema.auditLogs.targetId,
      details: schema.auditLogs.details,
      createdAt: schema.auditLogs.createdAt,
    })
    .from(schema.auditLogs)
    .leftJoin(schema.users, eq(schema.auditLogs.actorId, schema.users.id))
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.auditLogs);

  return {
    logs,
    total: Number(count),
  };
}
