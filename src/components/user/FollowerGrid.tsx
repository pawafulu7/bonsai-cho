import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  FollowerGridProps,
  FollowListUser,
  UserCardProps,
} from "@/types/user";
import { UserCard } from "./UserCard";

/**
 * FollowerGrid - User card grid with pagination
 *
 * Features:
 * - Cursor-based pagination
 * - Intersection Observer for automatic loading
 * - Manual "Load More" button (a11y)
 * - aria-live for screen reader announcements
 * - Responsive grid (1-3 columns)
 */
export function FollowerGrid({
  userId,
  type,
  initialData = [],
  initialCursor = null,
  initialHasMore = true,
  csrfToken,
}: FollowerGridProps) {
  const [users, setUsers] = useState<UserCardProps[]>(initialData);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [loadCount, setLoadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Load more users
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ limit: "20" });
      if (cursor) {
        params.set("cursor", cursor);
      }

      const response = await fetch(
        `/api/users/${encodeURIComponent(userId)}/${type}?${params.toString()}`,
        { credentials: "include" }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch ${type}`);
      }

      const data = await response.json();

      // Map API response to UserCardProps
      const newUsers: UserCardProps[] = data.data.map(
        (user: FollowListUser) => ({
          id: user.id,
          name: user.name,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          isFollowing: user.isFollowing,
          showFollowButton: true,
          csrfToken,
        })
      );

      setUsers((prev) => [...prev, ...newUsers]);
      setHasMore(data.hasMore);
      setCursor(data.nextCursor);
      setLoadCount((prev) => prev + 1);
    } catch (err) {
      console.error(`Error loading ${type}:`, err);
      setError("読み込みに失敗しました。もう一度お試しください。");
    } finally {
      setIsLoading(false);
    }
  }, [cursor, csrfToken, hasMore, isLoading, type, userId]);

  // Initial fetch if no data provided
  // biome-ignore lint/correctness/useExhaustiveDependencies: Initial load only, intentionally empty deps
  useEffect(() => {
    if (initialData.length === 0 && hasMore) {
      loadMore();
    }
  }, []);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element || !hasMore || isLoading || error) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !isLoading && !error) {
          loadMore();
        }
      },
      {
        rootMargin: "100px",
        threshold: 0.1,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoading, loadMore, error]);

  const typeLabel = type === "followers" ? "フォロワー" : "フォロー中";

  // Empty state
  if (users.length === 0 && !isLoading && !error) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground text-lg">
          {type === "followers"
            ? "まだフォロワーがいません"
            : "まだ誰もフォローしていません"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Live region for screen reader announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {loadCount > 0 && `${typeLabel}を読み込みました`}
      </div>

      {/* User Grid */}
      <div
        className={cn(
          "grid gap-4",
          "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        )}
        aria-busy={isLoading}
      >
        {users.map((user) => (
          <UserCard
            key={user.id}
            id={user.id}
            name={user.name}
            displayName={user.displayName}
            avatarUrl={user.avatarUrl}
            isFollowing={user.isFollowing}
            csrfToken={csrfToken}
            showFollowButton={user.showFollowButton}
          />
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="text-center py-4">
          <p className="text-destructive mb-2">{error}</p>
          <Button variant="outline" onClick={loadMore}>
            再試行
          </Button>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>読み込み中...</span>
          </div>
        </div>
      )}

      {/* Load More Trigger (for Intersection Observer) */}
      {hasMore && !isLoading && !error && (
        <div ref={loadMoreRef} className="h-4" aria-hidden="true" />
      )}

      {/* Manual Load More Button (a11y fallback) */}
      {hasMore && !error && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? "読み込み中..." : "もっと見る"}
          </Button>
        </div>
      )}

      {/* End of list message */}
      {!hasMore && users.length > 0 && (
        <p className="text-center text-sm text-muted-foreground py-4">
          すべての{typeLabel}を表示しました
        </p>
      )}
    </div>
  );
}
