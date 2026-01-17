import { useCallback, useState } from "react";
import type { CommentItem } from "@/server/routes/social.schema";
import type { UseCommentsOptions, UseCommentsReturn } from "@/types/social";

/**
 * useComments - Custom hook for comment functionality
 *
 * Provides optimistic update for add/delete with rollback on error.
 * Supports cursor-based pagination for loading more comments.
 */
export function useComments({
  bonsaiId,
  initialComments,
  initialHasMore,
  initialNextCursor,
  csrfToken,
}: UseCommentsOptions): UseCommentsReturn {
  const [comments, setComments] = useState<CommentItem[]>(initialComments);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPending, setIsPending] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialNextCursor
  );

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }
    return headers;
  }, [csrfToken]);

  // Add a new comment
  const addComment = useCallback(
    async (content: string) => {
      // Block while submitting or during delete operation (prevents rollback data loss)
      if (isSubmitting || isDeleting) return;
      setIsSubmitting(true);

      try {
        const response = await fetch(`/api/bonsai/${bonsaiId}/comments`, {
          method: "POST",
          headers: getHeaders(),
          credentials: "include",
          body: JSON.stringify({ content }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to add comment");
        }

        const data = await response.json();
        // Prepend new comment to list
        setComments((prev) => [data.comment, ...prev]);
      } finally {
        setIsSubmitting(false);
      }
    },
    [bonsaiId, getHeaders, isSubmitting, isDeleting]
  );

  // Delete a comment (optimistic update)
  const deleteComment = useCallback(
    async (commentId: string) => {
      // Block during delete or submit to prevent rollback data loss
      if (isDeleting || isSubmitting) return;

      const prevComments = comments;

      // Optimistic update
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setIsDeleting(true);

      try {
        const response = await fetch(
          `/api/bonsai/${bonsaiId}/comments/${commentId}`,
          {
            method: "DELETE",
            headers: getHeaders(),
            credentials: "include",
          }
        );

        if (!response.ok) {
          throw new Error("Failed to delete comment");
        }
      } catch {
        // Rollback on error
        setComments(prevComments);
      } finally {
        setIsDeleting(false);
      }
    },
    [bonsaiId, comments, getHeaders, isDeleting, isSubmitting]
  );

  // Load more comments (pagination)
  const loadMore = useCallback(async () => {
    if (isPending || !hasMore) return;
    setIsPending(true);

    try {
      const url = new URL(
        `/api/bonsai/${bonsaiId}/comments`,
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
        throw new Error("Failed to load comments");
      }

      const data = await response.json();
      setComments((prev) => [...prev, ...data.data]);
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } finally {
      setIsPending(false);
    }
  }, [bonsaiId, nextCursor, hasMore, isPending]);

  return {
    comments,
    hasMore,
    isPending,
    isSubmitting,
    addComment,
    deleteComment,
    loadMore,
  };
}
