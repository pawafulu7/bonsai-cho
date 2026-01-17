import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CareLogItem as CareLogItemType } from "@/server/routes/bonsai.schema";
import { CareLogItem } from "./CareLogItem";

interface CareLogTimelineProps {
  bonsaiId: string;
  initialLogs: CareLogItemType[];
  initialHasMore: boolean;
  initialNextCursor: string | null;
  className?: string;
}

/**
 * CareLogTimeline - Timeline display of care log entries
 *
 * Features:
 * - Vertical timeline with colored nodes
 * - Lazy loading with "Load more" button
 * - Accessible list structure
 */
export function CareLogTimeline({
  bonsaiId,
  initialLogs,
  initialHasMore,
  initialNextCursor,
  className,
}: CareLogTimelineProps) {
  const [logs, setLogs] = useState<CareLogItemType[]>(initialLogs);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialNextCursor
  );

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);

    try {
      const url = new URL(
        `/api/bonsai/${bonsaiId}/care-logs`,
        window.location.origin
      );
      url.searchParams.set("limit", "10");
      if (nextCursor) {
        url.searchParams.set("cursor", nextCursor);
      }

      const response = await fetch(url.toString(), {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to load care logs");
      }

      const data = await response.json();
      setLogs((prev) => [...prev, ...data.data]);
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch (error) {
      console.error("Error loading care logs:", error);
    } finally {
      setIsLoading(false);
    }
  }, [bonsaiId, nextCursor, hasMore, isLoading]);

  // Empty state
  if (logs.length === 0) {
    return (
      <div className={cn("text-center py-12", className)}>
        <p className="text-muted-foreground">まだお手入れ記録がありません</p>
      </div>
    );
  }

  return (
    <section className={className} aria-labelledby="carelog-heading">
      <h2
        id="carelog-heading"
        className="font-serif text-lg font-bold text-foreground mb-6"
      >
        お手入れ記録
      </h2>

      <ol
        className="relative border-l-2 border-primary/20 ml-4 space-y-6"
        aria-label="お手入れ履歴"
      >
        {logs.map((log) => (
          <CareLogItem key={log.id} log={log} />
        ))}
      </ol>

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center mt-8">
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
    </section>
  );
}
