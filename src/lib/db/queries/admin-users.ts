/**
 * Admin User Management Queries
 *
 * Provides user listing and search functionality for admin dashboard.
 */

import { and, count, eq, isNull, or, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

export type UserStatus = "active" | "suspended" | "banned";

/**
 * Escape SQL LIKE pattern special characters
 */
function escapeLikePattern(pattern: string): string {
  return pattern.replace(/[%_\\]/g, (char) => `\\${char}`);
}

export interface AdminUserListItem {
  id: string;
  email: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  statusReason: string | null;
  followerCount: number;
  followingCount: number;
  bonsaiCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserListOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: UserStatus;
  sortBy?: "createdAt" | "name" | "bonsaiCount";
  sortOrder?: "asc" | "desc";
}

export interface AdminUserListResult {
  users: AdminUserListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Get paginated list of users for admin dashboard
 */
export async function getAdminUserList(
  db: Database,
  options: AdminUserListOptions = {}
): Promise<AdminUserListResult> {
  const {
    page: rawPage = 1,
    limit: rawLimit = 20,
    search,
    status,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = options;

  // Validate and normalize pagination parameters to prevent zero division and negative offsets
  const page = Math.max(1, rawPage);
  const limit = Math.max(1, Math.min(rawLimit, 100));
  const offset = (page - 1) * limit;

  // Build where conditions
  const conditions = [isNull(schema.users.deletedAt)];

  if (status) {
    conditions.push(eq(schema.users.status, status));
  }

  if (search) {
    const escapedSearch = escapeLikePattern(search);
    const searchPattern = `%${escapedSearch.toLowerCase()}%`;
    // Use raw SQL with ESCAPE clause for proper escaping of LIKE wildcards
    conditions.push(
      or(
        sql`LOWER(${schema.users.name}) LIKE ${searchPattern} ESCAPE '\\'`,
        sql`LOWER(${schema.users.email}) LIKE ${searchPattern} ESCAPE '\\'`,
        sql`LOWER(${schema.users.displayName}) LIKE ${searchPattern} ESCAPE '\\'`
      ) as (typeof conditions)[0]
    );
  }

  const whereClause = and(...conditions);

  // Count total users matching criteria
  const [totalResult] = await db
    .select({ count: count() })
    .from(schema.users)
    .where(whereClause);

  const total = totalResult.count;

  // Build order by clause
  let orderByClause: ReturnType<typeof sql> | undefined;
  switch (sortBy) {
    case "name":
      orderByClause =
        sortOrder === "asc"
          ? sql`${schema.users.name} ASC`
          : sql`${schema.users.name} DESC`;
      break;
    case "bonsaiCount":
      // Will order by subquery result
      break;
    default:
      orderByClause =
        sortOrder === "asc"
          ? sql`${schema.users.createdAt} ASC`
          : sql`${schema.users.createdAt} DESC`;
      break;
  }

  // Get users with bonsai count
  const usersWithBonsaiCount = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      displayName: schema.users.displayName,
      avatarUrl: schema.users.avatarUrl,
      status: schema.users.status,
      statusReason: schema.users.statusReason,
      followerCount: schema.users.followerCount,
      followingCount: schema.users.followingCount,
      createdAt: schema.users.createdAt,
      updatedAt: schema.users.updatedAt,
      bonsaiCount: sql<number>`(
        SELECT COUNT(*) FROM ${schema.bonsai}
        WHERE ${schema.bonsai.userId} = ${schema.users.id}
        AND ${schema.bonsai.deletedAt} IS NULL
      )`,
    })
    .from(schema.users)
    .where(whereClause)
    .orderBy(
      sortBy === "bonsaiCount"
        ? sortOrder === "asc"
          ? sql`bonsaiCount ASC`
          : sql`bonsaiCount DESC`
        : orderByClause!
    )
    .limit(limit)
    .offset(offset);

  const users: AdminUserListItem[] = usersWithBonsaiCount.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    status: user.status as UserStatus,
    statusReason: user.statusReason,
    followerCount: user.followerCount,
    followingCount: user.followingCount,
    bonsaiCount: Number(user.bonsaiCount) || 0,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }));

  return {
    users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get a single user's details for admin view
 */
export async function getAdminUserDetail(
  db: Database,
  userId: string
): Promise<AdminUserListItem | null> {
  const [user] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      displayName: schema.users.displayName,
      avatarUrl: schema.users.avatarUrl,
      status: schema.users.status,
      statusReason: schema.users.statusReason,
      followerCount: schema.users.followerCount,
      followingCount: schema.users.followingCount,
      createdAt: schema.users.createdAt,
      updatedAt: schema.users.updatedAt,
      bonsaiCount: sql<number>`(
        SELECT COUNT(*) FROM ${schema.bonsai}
        WHERE ${schema.bonsai.userId} = ${schema.users.id}
        AND ${schema.bonsai.deletedAt} IS NULL
      )`,
    })
    .from(schema.users)
    .where(and(eq(schema.users.id, userId), isNull(schema.users.deletedAt)))
    .limit(1);

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    status: user.status as UserStatus,
    statusReason: user.statusReason,
    followerCount: user.followerCount,
    followingCount: user.followingCount,
    bonsaiCount: Number(user.bonsaiCount) || 0,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
