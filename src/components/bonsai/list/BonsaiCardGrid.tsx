import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BonsaiCardGridProps } from "@/types/social";
import { BonsaiCard } from "./BonsaiCard";
import { BonsaiListSkeleton } from "./BonsaiListSkeleton";
import { useBonsaiList } from "./useBonsaiList";

/**
 * BonsaiCardGrid - Infinite scroll grid of bonsai cards
 *
 * Features:
 * - Intersection Observer for automatic loading
 * - Manual "Load More" button as fallback (a11y)
 * - Responsive grid (1-4 columns)
 * - Loading skeletons
 */
export function BonsaiCardGrid({
  initialData,
  initialCursor,
  initialHasMore,
}: BonsaiCardGridProps) {
  const { items, hasMore, isLoading, loadMore } = useBonsaiList({
    initialData,
    initialCursor,
    initialHasMore,
  });

  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !isLoading) {
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
  }, [hasMore, isLoading, loadMore]);

  // Empty state
  if (items.length === 0 && !isLoading) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground text-lg mb-4">
          まだ盆栽が登録されていません
        </p>
        <Button asChild>
          <a href="/bonsai/new">最初の盆栽を登録する</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Card Grid */}
      <div
        className={cn(
          "grid gap-6",
          "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        )}
        aria-busy={isLoading}
      >
        {items.map((bonsai) => (
          <BonsaiCard
            key={bonsai.id}
            id={bonsai.id}
            name={bonsai.name}
            description={bonsai.description}
            thumbnailUrl={bonsai.thumbnailUrl}
            speciesNameJa={bonsai.speciesNameJa}
            styleNameJa={bonsai.styleNameJa}
            likeCount={bonsai.likeCount}
            commentCount={bonsai.commentCount}
          />
        ))}
      </div>

      {/* Loading Skeleton */}
      {isLoading && <BonsaiListSkeleton count={4} />}

      {/* Load More Trigger (for Intersection Observer) */}
      {hasMore && !isLoading && (
        <div
          ref={loadMoreRef}
          className="flex justify-center py-4"
          aria-hidden="true"
        />
      )}

      {/* Manual Load More Button (a11y fallback) */}
      {hasMore && (
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
      {!hasMore && items.length > 0 && (
        <p className="text-center text-sm text-muted-foreground py-4">
          すべての盆栽を表示しました
        </p>
      )}
    </div>
  );
}
