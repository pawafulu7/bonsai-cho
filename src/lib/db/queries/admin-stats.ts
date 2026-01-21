/**
 * Admin Dashboard Statistics Queries
 *
 * Provides aggregated statistics for the admin dashboard.
 */

import { count, eq, isNull, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

export interface AdminStats {
  users: {
    total: number;
    active: number;
    suspended: number;
    banned: number;
    newThisWeek: number;
    newThisMonth: number;
  };
  bonsai: {
    total: number;
    public: number;
    private: number;
    newThisWeek: number;
    newThisMonth: number;
  };
  images: {
    total: number;
    newThisWeek: number;
    newThisMonth: number;
  };
  engagement: {
    totalLikes: number;
    totalComments: number;
    totalFollows: number;
  };
}

/**
 * Get admin dashboard statistics
 */
export async function getAdminStats(db: Database): Promise<AdminStats> {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const oneWeekAgoStr = oneWeekAgo.toISOString();
  const oneMonthAgoStr = oneMonthAgo.toISOString();

  // User statistics
  const [userStats] = await db
    .select({
      total: count(),
      active: sql<number>`SUM(CASE WHEN ${schema.users.status} = 'active' THEN 1 ELSE 0 END)`,
      suspended: sql<number>`SUM(CASE WHEN ${schema.users.status} = 'suspended' THEN 1 ELSE 0 END)`,
      banned: sql<number>`SUM(CASE WHEN ${schema.users.status} = 'banned' THEN 1 ELSE 0 END)`,
      newThisWeek: sql<number>`SUM(CASE WHEN ${schema.users.createdAt} >= ${oneWeekAgoStr} THEN 1 ELSE 0 END)`,
      newThisMonth: sql<number>`SUM(CASE WHEN ${schema.users.createdAt} >= ${oneMonthAgoStr} THEN 1 ELSE 0 END)`,
    })
    .from(schema.users)
    .where(isNull(schema.users.deletedAt));

  // Bonsai statistics
  const [bonsaiStats] = await db
    .select({
      total: count(),
      public: sql<number>`SUM(CASE WHEN ${schema.bonsai.isPublic} = 1 THEN 1 ELSE 0 END)`,
      private: sql<number>`SUM(CASE WHEN ${schema.bonsai.isPublic} = 0 THEN 1 ELSE 0 END)`,
      newThisWeek: sql<number>`SUM(CASE WHEN ${schema.bonsai.createdAt} >= ${oneWeekAgoStr} THEN 1 ELSE 0 END)`,
      newThisMonth: sql<number>`SUM(CASE WHEN ${schema.bonsai.createdAt} >= ${oneMonthAgoStr} THEN 1 ELSE 0 END)`,
    })
    .from(schema.bonsai)
    .where(isNull(schema.bonsai.deletedAt));

  // Image statistics
  const [imageStats] = await db
    .select({
      total: count(),
      newThisWeek: sql<number>`SUM(CASE WHEN ${schema.bonsaiImages.createdAt} >= ${oneWeekAgoStr} THEN 1 ELSE 0 END)`,
      newThisMonth: sql<number>`SUM(CASE WHEN ${schema.bonsaiImages.createdAt} >= ${oneMonthAgoStr} THEN 1 ELSE 0 END)`,
    })
    .from(schema.bonsaiImages);

  // Engagement statistics
  const [likeCount] = await db.select({ count: count() }).from(schema.likes);
  const [commentCount] = await db
    .select({ count: count() })
    .from(schema.comments)
    .where(isNull(schema.comments.deletedAt));
  const [followCount] = await db
    .select({ count: count() })
    .from(schema.follows);

  return {
    users: {
      total: userStats.total,
      active: Number(userStats.active) || 0,
      suspended: Number(userStats.suspended) || 0,
      banned: Number(userStats.banned) || 0,
      newThisWeek: Number(userStats.newThisWeek) || 0,
      newThisMonth: Number(userStats.newThisMonth) || 0,
    },
    bonsai: {
      total: bonsaiStats.total,
      public: Number(bonsaiStats.public) || 0,
      private: Number(bonsaiStats.private) || 0,
      newThisWeek: Number(bonsaiStats.newThisWeek) || 0,
      newThisMonth: Number(bonsaiStats.newThisMonth) || 0,
    },
    images: {
      total: imageStats.total,
      newThisWeek: Number(imageStats.newThisWeek) || 0,
      newThisMonth: Number(imageStats.newThisMonth) || 0,
    },
    engagement: {
      totalLikes: likeCount.count,
      totalComments: commentCount.count,
      totalFollows: followCount.count,
    },
  };
}

export interface RecentActivity {
  type: "user_registered" | "bonsai_created" | "image_uploaded";
  id: string;
  title: string;
  description: string;
  timestamp: string;
}

/**
 * Get recent activity for the admin dashboard
 */
export async function getRecentActivity(
  db: Database,
  limit = 10
): Promise<RecentActivity[]> {
  // Get recent users
  const recentUsers = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(isNull(schema.users.deletedAt))
    .orderBy(sql`${schema.users.createdAt} DESC`)
    .limit(limit);

  // Get recent bonsai
  const recentBonsai = await db
    .select({
      id: schema.bonsai.id,
      name: schema.bonsai.name,
      userName: schema.users.name,
      createdAt: schema.bonsai.createdAt,
    })
    .from(schema.bonsai)
    .leftJoin(schema.users, eq(schema.bonsai.userId, schema.users.id))
    .where(isNull(schema.bonsai.deletedAt))
    .orderBy(sql`${schema.bonsai.createdAt} DESC`)
    .limit(limit);

  // Get recent images
  const recentImages = await db
    .select({
      id: schema.bonsaiImages.id,
      bonsaiName: schema.bonsai.name,
      userName: schema.users.name,
      createdAt: schema.bonsaiImages.createdAt,
    })
    .from(schema.bonsaiImages)
    .leftJoin(schema.bonsai, eq(schema.bonsaiImages.bonsaiId, schema.bonsai.id))
    .leftJoin(schema.users, eq(schema.bonsai.userId, schema.users.id))
    .orderBy(sql`${schema.bonsaiImages.createdAt} DESC`)
    .limit(limit);

  // Combine and sort activities
  const activities: RecentActivity[] = [
    ...recentUsers.map((user) => ({
      type: "user_registered" as const,
      id: user.id,
      title: "新規ユーザー登録",
      description: user.name,
      timestamp: user.createdAt,
    })),
    ...recentBonsai.map((b) => ({
      type: "bonsai_created" as const,
      id: b.id,
      title: "盆栽を登録",
      description: `${b.userName || "不明"} が「${b.name}」を登録`,
      timestamp: b.createdAt,
    })),
    ...recentImages.map((img) => ({
      type: "image_uploaded" as const,
      id: img.id,
      title: "画像をアップロード",
      description: `${img.userName || "不明"} が「${img.bonsaiName || "不明"}」に画像を追加`,
      timestamp: img.createdAt,
    })),
  ];

  // Sort by timestamp descending and limit
  return activities
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .slice(0, limit);
}
