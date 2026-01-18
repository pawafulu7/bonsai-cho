import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CommentSectionProps } from "@/types/social";
import { CommentForm } from "./CommentForm";
import { CommentItem } from "./CommentItem";
import { useComments } from "./useComments";

/**
 * CommentSection - Full comment section with form and list
 *
 * Features:
 * - Comment form with validation
 * - Comment list with pagination
 * - Optimistic updates for add/delete
 * - Accessible section labeling
 * - Empty state message
 */
export function CommentSection({
  bonsaiId,
  initialComments,
  initialHasMore,
  initialNextCursor,
  currentUserId,
  bonsaiOwnerId,
  csrfToken,
  className,
}: CommentSectionProps) {
  const {
    comments,
    hasMore,
    isPending,
    isSubmitting,
    addComment,
    deleteComment,
    loadMore,
  } = useComments({
    bonsaiId,
    initialComments,
    initialHasMore,
    initialNextCursor,
    csrfToken,
  });

  const isAuthenticated = currentUserId !== null;
  const commentCount = comments.length;

  return (
    <section
      className={cn("bg-muted/30 rounded-xl p-6 space-y-6", className)}
      aria-labelledby="comments-heading"
    >
      {/* Section Header */}
      <header className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2
          id="comments-heading"
          className="font-serif text-lg font-bold text-foreground"
        >
          コメント
          <span className="text-muted-foreground font-normal ml-1">
            ({commentCount}件)
          </span>
        </h2>
      </header>

      {/* Comment Form - Only show for authenticated users */}
      {isAuthenticated ? (
        <CommentForm
          bonsaiId={bonsaiId}
          csrfToken={csrfToken}
          onSubmit={addComment}
          isPending={isSubmitting}
        />
      ) : (
        <p className="text-sm text-muted-foreground bg-card rounded-lg p-4 text-center">
          コメントするには
          <a
            href="/auth/login"
            className="text-primary underline underline-offset-4 font-medium mx-1 hover:text-primary/80 focus:text-primary/80"
          >
            ログイン
          </a>
          してください
        </p>
      )}

      {/* Comment List */}
      {comments.length > 0 ? (
        <div className="space-y-4">
          <ol className="space-y-3" aria-label="コメント一覧">
            {comments.map((comment, index) => (
              <li
                key={comment.id}
                className={index === 0 && isSubmitting ? "" : "animate-fade-in"}
              >
                <CommentItem
                  comment={comment}
                  canDelete={
                    comment.userId === currentUserId ||
                    currentUserId === bonsaiOwnerId
                  }
                  onDelete={() => deleteComment(comment.id)}
                  isPending={isPending}
                />
              </li>
            ))}
          </ol>

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={isPending}
                aria-busy={isPending}
              >
                {isPending ? "読み込み中..." : "もっと見る"}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm text-center py-8">
          まだコメントはありません
        </p>
      )}
    </section>
  );
}
