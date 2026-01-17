import { Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CommentFormProps } from "@/types/social";

/**
 * CommentForm - Comment submission form
 *
 * Features:
 * - Character limit validation (1-1000 characters)
 * - Accessible form with proper labels
 * - Ctrl+Enter keyboard shortcut
 * - Loading state during submission
 */
export function CommentForm({
  bonsaiId,
  csrfToken: _csrfToken,
  onSubmit,
  isPending = false,
  className,
}: CommentFormProps) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const MAX_LENGTH = 1000;
  const isValid = content.trim().length >= 1 && content.length <= MAX_LENGTH;
  const remainingChars = MAX_LENGTH - content.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid || isPending) return;

    setError(null);
    try {
      await onSubmit(content.trim());
      setContent(""); // Clear form on success
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "コメントの送信に失敗しました"
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to submit
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (isValid && !isPending) {
        handleSubmit(e as unknown as React.FormEvent);
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("space-y-3", className)}
      aria-label="コメントを投稿"
    >
      <div className="relative">
        <label htmlFor={`comment-input-${bonsaiId}`} className="sr-only">
          コメント内容
        </label>
        <textarea
          id={`comment-input-${bonsaiId}`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="コメントを入力..."
          maxLength={MAX_LENGTH}
          required
          disabled={isPending}
          aria-describedby={`comment-hint-${bonsaiId} ${error ? `comment-error-${bonsaiId}` : ""}`}
          className={cn(
            "w-full p-3 rounded-lg",
            "border border-border bg-card",
            "min-h-[100px] resize-y",
            "text-sm placeholder:text-muted-foreground",
            "focus:border-primary focus:ring-1 focus:ring-primary",
            "transition-colors duration-150",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error &&
              "border-destructive focus:border-destructive focus:ring-destructive"
          )}
        />

        {/* Character count */}
        <div
          className={cn(
            "absolute bottom-2 right-2 text-xs",
            remainingChars < 100 ? "text-amber-500" : "text-muted-foreground",
            remainingChars < 0 && "text-destructive"
          )}
          aria-live="polite"
        >
          {remainingChars}
        </div>
      </div>

      <p id={`comment-hint-${bonsaiId}`} className="sr-only">
        1文字以上1000文字以内で入力してください。Ctrl+Enterで送信できます。
      </p>

      {error && (
        <p
          id={`comment-error-${bonsaiId}`}
          className="text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground hidden sm:block">
          Ctrl+Enter で送信
        </p>
        <Button
          type="submit"
          disabled={!isValid || isPending}
          className="ml-auto"
        >
          {isPending ? (
            "送信中..."
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden="true" />
              <span>コメント</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
