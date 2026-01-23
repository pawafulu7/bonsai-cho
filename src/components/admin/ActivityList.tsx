/**
 * Activity List Component
 *
 * Displays recent activity feed for the admin dashboard.
 */

import { ImagePlus, Leaf, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Activity {
  type: "user_registered" | "bonsai_created" | "image_uploaded";
  id: string;
  title: string;
  description: string;
  timestamp: string;
}

interface ActivityListProps {
  activities: Activity[];
  className?: string;
}

const activityIcons = {
  user_registered: UserPlus,
  bonsai_created: Leaf,
  image_uploaded: ImagePlus,
};

const activityColors = {
  user_registered: "bg-blue-100 text-blue-600",
  bonsai_created: "bg-green-100 text-green-600",
  image_uploaded: "bg-purple-100 text-purple-600",
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);

  // Handle invalid dates
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // Handle future dates (clock skew, timezone issues)
  if (diffMs < 0) {
    return "たった今";
  }

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "たった今";
  if (diffMins < 60) return `${diffMins}分前`;
  if (diffHours < 24) return `${diffHours}時間前`;
  if (diffDays < 7) return `${diffDays}日前`;

  return date.toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
  });
}

export function ActivityList({ activities, className }: ActivityListProps) {
  if (activities.length === 0) {
    return (
      <div
        className={cn("rounded-lg border border-border bg-card p-6", className)}
      >
        <p className="text-center text-sm text-muted-foreground">
          最近のアクティビティはありません
        </p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-border bg-card", className)}>
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-medium text-foreground">最近のアクティビティ</h3>
      </div>
      <div className="divide-y divide-border">
        {activities.map((activity) => {
          const Icon = activityIcons[activity.type];
          const colorClass = activityColors[activity.type];

          return (
            <div
              key={`${activity.type}-${activity.id}`}
              className="flex items-start gap-3 p-4"
            >
              <div className={cn("rounded-full p-2", colorClass)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {activity.title}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {activity.description}
                </p>
              </div>
              <time className="whitespace-nowrap text-xs text-muted-foreground">
                {formatRelativeTime(activity.timestamp)}
              </time>
            </div>
          );
        })}
      </div>
    </div>
  );
}
