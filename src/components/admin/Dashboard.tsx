/**
 * Admin Dashboard Component
 *
 * Main dashboard view with statistics and activity feed.
 */

import {
  Heart,
  Image,
  Leaf,
  MessageSquare,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import { useEffect, useState } from "react";

import { ActivityList } from "./ActivityList";
import { StatCard } from "./StatCard";

interface AdminStats {
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

interface Activity {
  type: "user_registered" | "bonsai_created" | "image_uploaded";
  id: string;
  title: string;
  description: string;
  timestamp: string;
}

interface DashboardProps {
  csrfToken: string | null;
}

export function Dashboard({ csrfToken: _csrfToken }: DashboardProps) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);

      try {
        const [statsRes, activityRes] = await Promise.all([
          fetch("/api/admin/stats", {
            credentials: "include",
          }),
          fetch("/api/admin/activity?limit=10", {
            credentials: "include",
          }),
        ]);

        if (!statsRes.ok) {
          const errorData = await statsRes.json();
          throw new Error(errorData.error || "統計情報の取得に失敗しました");
        }

        if (!activityRes.ok) {
          const errorData = await activityRes.json();
          throw new Error(
            errorData.error || "アクティビティの取得に失敗しました"
          );
        }

        const statsData = await statsRes.json();
        const activityData = await activityRes.json();

        setStats(statsData.data);
        setActivities(activityData.data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "データの取得に失敗しました"
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">ダッシュボード</h1>
        <p className="text-sm text-muted-foreground">
          プラットフォームの概要と最近のアクティビティ
        </p>
      </div>

      {/* User Statistics */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">ユーザー</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="総ユーザー数"
            value={stats.users.total}
            icon={Users}
            trend={{
              value: stats.users.newThisWeek,
              label: "今週の新規",
            }}
          />
          <StatCard
            label="アクティブ"
            value={stats.users.active}
            icon={UserCheck}
            description="正常なアカウント"
          />
          <StatCard
            label="一時停止中"
            value={stats.users.suspended}
            icon={UserX}
            description="一時的に制限中"
          />
          <StatCard
            label="BAN済み"
            value={stats.users.banned}
            icon={UserX}
            description="永久停止"
          />
        </div>
      </section>

      {/* Content Statistics */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          コンテンツ
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="盆栽"
            value={stats.bonsai.total}
            icon={Leaf}
            trend={{
              value: stats.bonsai.newThisWeek,
              label: "今週の新規",
            }}
          />
          <StatCard
            label="公開中"
            value={stats.bonsai.public}
            description="公開されている盆栽"
          />
          <StatCard
            label="非公開"
            value={stats.bonsai.private}
            description="非公開の盆栽"
          />
          <StatCard
            label="画像"
            value={stats.images.total}
            icon={Image}
            trend={{
              value: stats.images.newThisWeek,
              label: "今週の新規",
            }}
          />
        </div>
      </section>

      {/* Engagement Statistics */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          エンゲージメント
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="いいね"
            value={stats.engagement.totalLikes}
            icon={Heart}
            description="総いいね数"
          />
          <StatCard
            label="コメント"
            value={stats.engagement.totalComments}
            icon={MessageSquare}
            description="総コメント数"
          />
          <StatCard
            label="フォロー"
            value={stats.engagement.totalFollows}
            icon={Users}
            description="フォロー関係数"
          />
        </div>
      </section>

      {/* Recent Activity */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          最近のアクティビティ
        </h2>
        <ActivityList activities={activities} />
      </section>
    </div>
  );
}
