import { useCallback, useState } from "react";
import type {
  BonsaiListItemWithSocial,
  UseBonsaiListReturn,
} from "@/types/social";

/**
 * API response type for bonsai list endpoint
 */
interface BonsaiListApiResponse {
  data: BonsaiListItemWithSocial[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface UseBonsaiListOptions {
  initialData: BonsaiListItemWithSocial[];
  initialCursor: string | null;
  initialHasMore: boolean;
}

/**
 * useBonsaiList - Custom hook for bonsai list pagination
 *
 * Provides cursor-based pagination for infinite scroll.
 */
export function useBonsaiList({
  initialData,
  initialCursor,
  initialHasMore,
}: UseBonsaiListOptions): UseBonsaiListReturn {
  const [items, setItems] = useState<BonsaiListItemWithSocial[]>(initialData);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);

    try {
      const url = new URL("/api/bonsai", window.location.origin);
      url.searchParams.set("limit", "20");
      if (cursor) {
        url.searchParams.set("cursor", cursor);
      }

      const response = await fetch(url.toString(), {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to load bonsai list");
      }

      const data: BonsaiListApiResponse = await response.json();
      setItems((prev) => [...prev, ...data.data]);
      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error("Error loading more items:", error);
    } finally {
      setIsLoading(false);
    }
  }, [cursor, hasMore, isLoading]);

  return {
    items,
    hasMore,
    isLoading,
    loadMore,
  };
}
