/**
 * User Management Component
 *
 * Main component for the user management page with search, filtering, and moderation actions.
 */

import { Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Pagination } from "./Pagination";
import { UserTable } from "./UserTable";

type UserStatus = "active" | "suspended" | "banned";

interface UserItem {
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

interface UserListResult {
  users: UserItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface UserManagementProps {
  currentUserId: string;
  csrfToken: string | null;
}

export function UserManagement({
  currentUserId,
  csrfToken,
}: UserManagementProps) {
  const [result, setResult] = useState<UserListResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Filter state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "">("");
  const [page, setPage] = useState(1);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "20");
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "ユーザー一覧の取得に失敗しました");
      }

      const data = await res.json();
      setResult(data.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "データの取得に失敗しました"
      );
    } finally {
      setIsLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Handle search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  // Handle moderation action
  const handleModerationAction = async (
    action: "ban" | "suspend" | "unban",
    userId: string
  ) => {
    if (!csrfToken) {
      setError("CSRF token not found. Please refresh the page.");
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/users/${userId}/${action}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "操作に失敗しました");
      }

      // Refresh the user list
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作に失敗しました");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">ユーザー管理</h1>
        <p className="text-sm text-muted-foreground">
          ユーザーの検索、フィルタリング、モデレーション
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex-1">
          <label
            htmlFor="user-search"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            検索
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="user-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="名前またはメールアドレス"
              className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </form>

        {/* Status Filter */}
        <div>
          <label
            htmlFor="user-status-filter"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            ステータス
          </label>
          <select
            id="user-status-filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as UserStatus | "");
              setPage(1);
            }}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-40"
          >
            <option value="">すべて</option>
            <option value="active">アクティブ</option>
            <option value="suspended">一時停止</option>
            <option value="banned">BAN</option>
          </select>
        </div>

        {/* Search Button */}
        <Button type="submit" onClick={handleSearchSubmit}>
          検索
        </Button>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="text-muted-foreground">読み込み中...</div>
        </div>
      ) : result ? (
        <>
          {/* Results info */}
          <div className="text-sm text-muted-foreground">
            {result.total}件のユーザーが見つかりました
          </div>

          {/* User Table */}
          <UserTable
            users={result.users}
            currentUserId={currentUserId}
            onBan={(userId) => handleModerationAction("ban", userId)}
            onSuspend={(userId) => handleModerationAction("suspend", userId)}
            onUnban={(userId) => handleModerationAction("unban", userId)}
            isLoading={actionLoading}
          />

          {/* Pagination */}
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            onPageChange={setPage}
          />
        </>
      ) : null}
    </div>
  );
}
