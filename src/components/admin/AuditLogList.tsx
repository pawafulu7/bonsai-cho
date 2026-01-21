/**
 * Audit Log List Component
 *
 * Displays a list of audit log entries for admin review.
 */

import { History, Settings, Shield, User } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AuditLogItem {
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

const actionLabels: Record<string, string> = {
  "user.ban": "ユーザーBAN",
  "user.suspend": "ユーザー一時停止",
  "user.unban": "ユーザーBAN解除",
  "settings.update": "設定変更",
  "admin.login": "管理者ログイン",
};

const actionIcons: Record<string, typeof User> = {
  "user.ban": User,
  "user.suspend": User,
  "user.unban": User,
  "settings.update": Settings,
  "admin.login": Shield,
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseDetails(details: string | null): Record<string, unknown> | null {
  if (!details) return null;
  try {
    return JSON.parse(details);
  } catch {
    return null;
  }
}

export function AuditLogList() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/admin/settings/audit-logs?limit=${limit}&offset=${offset}`,
        {
          credentials: "include",
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "監査ログの取得に失敗しました");
      }

      const data = await res.json();
      setLogs(data.data);
      setTotal(data.total);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "データの取得に失敗しました"
      );
    } finally {
      setIsLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

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

  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <History className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">
          監査ログはまだありません
        </p>
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card">
        <div className="divide-y divide-border">
          {logs.map((log) => {
            const Icon = actionIcons[log.action] || History;
            const details = parseDetails(log.details);

            return (
              <div key={log.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-muted p-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {actionLabels[log.action] || log.action}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(log.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-foreground">
                      {log.actorName || "不明"}{" "}
                      {log.targetId && (
                        <span className="text-muted-foreground">
                          → {log.targetType}: {log.targetId}
                        </span>
                      )}
                    </p>
                    {details && (
                      <div className="mt-2 rounded bg-muted/50 p-2">
                        <pre className="text-xs text-muted-foreground">
                          {JSON.stringify(details, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.actorIp && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        IP: {log.actorIp}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {total}件中 {offset + 1}-{Math.min(offset + limit, total)}件
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
            >
              前へ
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(offset + limit)}
              disabled={currentPage >= totalPages}
            >
              次へ
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
