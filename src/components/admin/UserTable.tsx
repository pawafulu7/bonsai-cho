/**
 * User Table Component
 *
 * Displays a table of users with pagination and actions.
 */

import { Ban, MoreHorizontal, RefreshCw, ShieldOff, User } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

interface UserTableProps {
  users: UserItem[];
  currentUserId: string;
  onBan: (userId: string) => void;
  onSuspend: (userId: string) => void;
  onUnban: (userId: string) => void;
  isLoading?: boolean;
}

const statusBadgeVariants: Record<
  UserStatus,
  "default" | "secondary" | "destructive"
> = {
  active: "default",
  suspended: "secondary",
  banned: "destructive",
};

const statusLabels: Record<UserStatus, string> = {
  active: "アクティブ",
  suspended: "一時停止",
  banned: "BAN",
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function UserTable({
  users,
  currentUserId,
  onBan,
  onSuspend,
  onUnban,
  isLoading,
}: UserTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Handle Escape key to close dropdown menu
  useEffect(() => {
    if (!openMenuId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenMenuId(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [openMenuId]);

  const toggleMenu = (userId: string) => {
    setOpenMenuId(openMenuId === userId ? null : userId);
  };

  if (users.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <User className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">
          ユーザーが見つかりませんでした
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">ユーザー</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead className="text-right">盆栽</TableHead>
            <TableHead className="text-right">フォロワー</TableHead>
            <TableHead>登録日</TableHead>
            <TableHead className="w-[80px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const isCurrentUser = user.id === currentUserId;
            const isMenuOpen = openMenuId === user.id;

            return (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.name}
                        className="h-8 w-8 rounded-full"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {user.displayName || user.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={statusBadgeVariants[user.status]}>
                    {statusLabels[user.status]}
                  </Badge>
                  {user.statusReason && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {user.statusReason}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-right">{user.bonsaiCount}</TableCell>
                <TableCell className="text-right">
                  {user.followerCount}
                </TableCell>
                <TableCell>{formatDate(user.createdAt)}</TableCell>
                <TableCell>
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleMenu(user.id)}
                      disabled={isCurrentUser || isLoading}
                      className="h-8 w-8"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>

                    {isMenuOpen && (
                      <>
                        {/* Backdrop */}
                        <button
                          type="button"
                          className="fixed inset-0 z-10"
                          onClick={() => setOpenMenuId(null)}
                          aria-label="メニューを閉じる"
                        />

                        {/* Dropdown menu */}
                        <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-md border border-border bg-card py-1 shadow-lg">
                          {user.status === "active" && (
                            <>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                                onClick={() => {
                                  onSuspend(user.id);
                                  setOpenMenuId(null);
                                }}
                              >
                                <ShieldOff className="h-4 w-4" />
                                一時停止
                              </button>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted"
                                onClick={() => {
                                  onBan(user.id);
                                  setOpenMenuId(null);
                                }}
                              >
                                <Ban className="h-4 w-4" />
                                BAN
                              </button>
                            </>
                          )}
                          {user.status === "suspended" && (
                            <>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                                onClick={() => {
                                  onUnban(user.id);
                                  setOpenMenuId(null);
                                }}
                              >
                                <RefreshCw className="h-4 w-4" />
                                解除
                              </button>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted"
                                onClick={() => {
                                  onBan(user.id);
                                  setOpenMenuId(null);
                                }}
                              >
                                <Ban className="h-4 w-4" />
                                BAN
                              </button>
                            </>
                          )}
                          {user.status === "banned" && (
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                              onClick={() => {
                                onUnban(user.id);
                                setOpenMenuId(null);
                              }}
                            >
                              <RefreshCw className="h-4 w-4" />
                              BAN解除
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
