import { useCallback, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ImageDropzone } from "./ImageDropzone";
import { type QuickAddProgress, useQuickAddBonsai } from "./useQuickAddBonsai";

/**
 * Props for QuickAddForm component
 */
export interface QuickAddFormProps {
  /** CSRF token for API requests */
  csrfToken: string;
  /** Callback on successful submit - receives bonsai ID */
  onSuccess?: (bonsaiId: string) => void;
  /** Callback when cancel button is clicked */
  onCancel?: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * Progress indicator component
 */
function ProgressIndicator({ progress }: { progress: QuickAddProgress }) {
  const getProgressText = () => {
    switch (progress) {
      case "resizing":
        return "画像を処理中...";
      case "creating":
        return "盆栽を登録中...";
      case "uploading":
        return "画像をアップロード中...";
      case "complete":
        return "完了しました";
      default:
        return null;
    }
  };

  const text = getProgressText();
  if (!text) return null;

  return (
    <output
      aria-live="polite"
      className="flex items-center gap-2 text-sm text-muted-foreground"
    >
      {progress !== "complete" && (
        <svg
          className="h-4 w-4 animate-spin"
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
      )}
      {progress === "complete" && (
        <svg
          className="h-4 w-4 text-green-600"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
      <span>{text}</span>
    </output>
  );
}

/**
 * QuickAddForm - Simplified form for quick bonsai registration
 *
 * Features:
 * - Image-first design
 * - Minimal required fields (image + name)
 * - Optional memo field
 * - Progress indication during upload
 * - Accessible form with proper labeling
 * - Mobile-optimized layout
 */
export function QuickAddForm({
  csrfToken,
  onSuccess,
  onCancel,
  className,
}: QuickAddFormProps) {
  const formId = useId();

  // Form state
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [memo, setMemo] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  // Quick add hook
  const { submit, isSubmitting, progress, error, createdBonsaiId } =
    useQuickAddBonsai({
      csrfToken,
      onSuccess,
    });

  // Generate unique IDs for accessibility
  const nameId = `${formId}-name`;
  const memoId = `${formId}-memo`;
  const nameErrorId = `${nameId}-error`;

  // Handle image selection
  const handleImageSelect = useCallback((file: File) => {
    setSelectedImage(file);
  }, []);

  // Handle image clear
  const handleImageClear = useCallback(() => {
    setSelectedImage(null);
  }, []);

  // Validate name
  const validateName = useCallback(() => {
    if (!name.trim()) {
      setNameError("名前を入力してください");
      return false;
    }
    if (name.length > 100) {
      setNameError("名前は100文字以内で入力してください");
      return false;
    }
    setNameError(null);
    return true;
  }, [name]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Validate
      if (!validateName()) {
        return;
      }

      if (!selectedImage) {
        return;
      }

      // Submit
      await submit({
        image: selectedImage,
        name,
        memo: memo.trim() || undefined,
      });
    },
    [validateName, selectedImage, submit, name, memo]
  );

  // Check if form can be submitted
  const canSubmit =
    !isSubmitting && selectedImage !== null && name.trim().length > 0;

  // Show success state with redirect option
  if (progress === "complete" && createdBonsaiId) {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="rounded-lg bg-green-50 p-6 text-center dark:bg-green-950/20">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <svg
              className="h-6 w-6 text-green-600"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            登録が完了しました
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            盆栽が正常に登録されました。詳細ページで追加情報を編集できます。
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            type="button"
            onClick={() => {
              window.location.href = `/bonsai/${createdBonsaiId}`;
            }}
          >
            詳細ページを見る
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.location.href = "/bonsai/quick-add";
            }}
          >
            続けて登録する
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("space-y-6", className)}
      aria-label="クイック登録フォーム"
    >
      {/* Error message */}
      {error && (
        <div
          role="alert"
          className="rounded-lg bg-destructive/10 p-4 text-destructive"
        >
          {error}
          {createdBonsaiId && (
            <div className="mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  window.location.href = `/bonsai/${createdBonsaiId}`;
                }}
              >
                詳細ページで画像を追加
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Image upload */}
      <div className="space-y-2">
        <Label>
          写真 <span className="text-destructive">*</span>
        </Label>
        <ImageDropzone
          onImageSelect={handleImageSelect}
          selectedImage={selectedImage}
          onClear={handleImageClear}
          disabled={isSubmitting}
          error={
            !selectedImage && isSubmitting ? "画像を選択してください" : null
          }
        />
      </div>

      {/* Name input */}
      <div className="space-y-2">
        <Label htmlFor={nameId}>
          名前 <span className="text-destructive">*</span>
        </Label>
        <Input
          id={nameId}
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameError(null);
          }}
          onBlur={validateName}
          disabled={isSubmitting}
          aria-required="true"
          aria-invalid={!!nameError}
          aria-describedby={nameError ? nameErrorId : undefined}
          placeholder="盆栽の名前"
          maxLength={100}
          autoComplete="off"
        />
        {nameError && (
          <p id={nameErrorId} role="alert" className="text-sm text-destructive">
            {nameError}
          </p>
        )}
      </div>

      {/* Memo input (optional) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={memoId}>メモ</Label>
          <span className="text-xs text-muted-foreground">
            {memo.length}/500
          </span>
        </div>
        <Textarea
          id={memoId}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          disabled={isSubmitting}
          placeholder="樹種、入手先、育て方のメモなど（任意）"
          rows={3}
          maxLength={500}
        />
      </div>

      {/* Progress indicator */}
      {isSubmitting && <ProgressIndicator progress={progress} />}

      {/* Form actions */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            キャンセル
          </Button>
        )}
        <Button type="submit" disabled={!canSubmit}>
          {isSubmitting ? "登録中..." : "登録する"}
        </Button>
      </div>

      {/* Help text */}
      <p className="text-center text-xs text-muted-foreground">
        詳細情報は登録後に追加・編集できます
      </p>
    </form>
  );
}
