import { useCallback, useState } from "react";
import { needsResize, resizeImage } from "@/lib/utils/image-resize";

/**
 * Progress states for quick add operation
 */
export type QuickAddProgress =
  | "idle"
  | "resizing"
  | "creating"
  | "uploading"
  | "complete"
  | "error";

/**
 * Data for quick add form
 */
export interface QuickAddData {
  /** Image file to upload */
  image: File;
  /** Bonsai name (required) */
  name: string;
  /** Optional memo/note */
  memo?: string;
}

/**
 * Options for useQuickAddBonsai hook
 */
export interface UseQuickAddBonsaiOptions {
  /** CSRF token for API requests */
  csrfToken: string;
  /** Callback on successful completion */
  onSuccess?: (bonsaiId: string) => void;
}

/**
 * Return type for useQuickAddBonsai hook
 */
export interface UseQuickAddBonsaiReturn {
  /** Submit the quick add form */
  submit: (data: QuickAddData) => Promise<void>;
  /** Whether a submission is in progress */
  isSubmitting: boolean;
  /** Current progress state */
  progress: QuickAddProgress;
  /** Error message if any */
  error: string | null;
  /** Created bonsai ID (available after successful creation) */
  createdBonsaiId: string | null;
  /** Reset the hook state */
  reset: () => void;
}

/**
 * Create bonsai via API
 */
async function createBonsai(
  name: string,
  memo: string | undefined,
  csrfToken: string
): Promise<string> {
  const response = await fetch("/api/bonsai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    credentials: "include",
    body: JSON.stringify({
      name: name.trim(),
      description: memo?.trim() || null,
      isPublic: true, // Default to public for quick add
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || errorData.message || `API error: ${response.status}`
    );
  }

  const result = await response.json();
  return result.id;
}

/**
 * Upload image to bonsai via API
 */
async function uploadImage(
  bonsaiId: string,
  imageBlob: Blob,
  filename: string,
  csrfToken: string
): Promise<void> {
  const formData = new FormData();
  formData.append("file", imageBlob, filename);
  formData.append("isPrimary", "true");

  const response = await fetch(`/api/bonsai/${bonsaiId}/images`, {
    method: "POST",
    headers: {
      "X-CSRF-Token": csrfToken,
    },
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error ||
        errorData.message ||
        `Image upload failed: ${response.status}`
    );
  }
}

/**
 * Generate a safe filename with extension based on format
 */
function generateFilename(originalName: string, format: string): string {
  const baseName = originalName.replace(/\.[^/.]+$/, "");
  const extension = format === "image/webp" ? ".webp" : ".jpg";
  return `${baseName}${extension}`;
}

/**
 * useQuickAddBonsai - Custom hook for quick bonsai registration
 *
 * Handles the two-step process of:
 * 1. Creating a bonsai entry with name and optional memo
 * 2. Uploading and attaching an image to the bonsai
 *
 * Features:
 * - Client-side image resizing before upload
 * - Progress tracking through each step
 * - Error handling with recovery (bonsai created but image failed)
 * - Idempotent design (can retry image upload on failure)
 */
export function useQuickAddBonsai({
  csrfToken,
  onSuccess,
}: UseQuickAddBonsaiOptions): UseQuickAddBonsaiReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState<QuickAddProgress>("idle");
  const [error, setError] = useState<string | null>(null);
  const [createdBonsaiId, setCreatedBonsaiId] = useState<string | null>(null);

  const reset = useCallback(() => {
    setIsSubmitting(false);
    setProgress("idle");
    setError(null);
    setCreatedBonsaiId(null);
  }, []);

  const submit = useCallback(
    async (data: QuickAddData) => {
      // Validate input
      if (!data.name.trim()) {
        setError("名前を入力してください");
        return;
      }

      if (!data.image) {
        setError("画像を選択してください");
        return;
      }

      setIsSubmitting(true);
      setError(null);
      setProgress("idle");

      let bonsaiId: string | null = null;

      try {
        // Step 1: Resize image if needed
        setProgress("resizing");
        let imageBlob: Blob = data.image;
        let filename = data.image.name;

        const shouldResize = await needsResize(data.image);
        if (shouldResize) {
          const resizeResult = await resizeImage(data.image, {
            maxWidth: 2048,
            maxHeight: 2048,
            quality: 0.85,
            format: "image/jpeg",
          });
          imageBlob = resizeResult.blob;
          filename = generateFilename(data.image.name, "image/jpeg");
        }

        // Step 2: Create bonsai
        setProgress("creating");
        bonsaiId = await createBonsai(data.name, data.memo, csrfToken);
        setCreatedBonsaiId(bonsaiId);

        // Step 3: Upload image
        setProgress("uploading");
        await uploadImage(bonsaiId, imageBlob, filename, csrfToken);

        // Success
        setProgress("complete");
        onSuccess?.(bonsaiId);
      } catch (err) {
        console.error("Quick add error:", err);
        setProgress("error");

        // Provide specific error messages
        if (bonsaiId && progress === "uploading") {
          // Bonsai was created but image upload failed
          setError(
            "盆栽は登録されましたが、画像のアップロードに失敗しました。詳細ページから画像を追加できます。"
          );
        } else if (progress === "creating") {
          setError(
            err instanceof Error
              ? err.message
              : "盆栽の登録に失敗しました。もう一度お試しください。"
          );
        } else if (progress === "resizing") {
          setError("画像の処理に失敗しました。別の画像をお試しください。");
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "エラーが発生しました。もう一度お試しください。"
          );
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [csrfToken, onSuccess, progress]
  );

  return {
    submit,
    isSubmitting,
    progress,
    error,
    createdBonsaiId,
    reset,
  };
}
