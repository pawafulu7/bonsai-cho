import { useCallback, useState } from "react";
import {
  type PrepareResult,
  prepareImageForUpload,
} from "@/lib/utils/image-resize";
import type { Species, Style } from "./useBonsaiForm";

/**
 * Unified form state combining basic info (quick add) + detail info
 */
export interface UnifiedFormState {
  // Basic info
  images: File[];
  name: string;
  notes: string;

  // Details
  speciesId: string;
  styleId: string;
  acquiredAt: string;
  estimatedAge: string;
  height: string;
  width: string;
  potDetails: string;
  isPublic: boolean;
}

/**
 * Form validation errors
 */
export interface UnifiedFormErrors {
  name?: string;
  notes?: string;
  images?: string;
  acquiredAt?: string;
  estimatedAge?: string;
  height?: string;
  width?: string;
  general?: string;
}

/**
 * Submit progress states
 */
export type SubmitProgress =
  | "idle"
  | "resizing"
  | "creating"
  | "uploading"
  | "complete"
  | "error";

/**
 * Progress detail for multi-image upload
 */
export interface UploadProgress {
  current: number;
  total: number;
}

/**
 * Props for useUnifiedBonsaiForm hook
 */
export interface UseUnifiedBonsaiFormProps {
  csrfToken: string;
  speciesList: Species[];
  styleList: Style[];
  onSuccess?: (bonsaiId: string) => void;
  maxImages?: number;
}

/**
 * Return type for useUnifiedBonsaiForm hook
 */
export interface UseUnifiedBonsaiFormReturn {
  // Form state
  formState: UnifiedFormState;
  errors: UnifiedFormErrors;
  progress: SubmitProgress;
  uploadProgress: UploadProgress;

  // State setters
  setImages: (images: File[]) => void;
  setName: (name: string) => void;
  setNotes: (notes: string) => void;
  setSpeciesId: (id: string) => void;
  setStyleId: (id: string) => void;
  setAcquiredAt: (date: string) => void;
  setEstimatedAge: (age: string) => void;
  setHeight: (height: string) => void;
  setWidth: (width: string) => void;
  setPotDetails: (details: string) => void;
  setIsPublic: (isPublic: boolean) => void;

  // Actions
  handleSubmit: () => Promise<void>;
  resetForm: () => void;

  // Derived state
  isSubmitting: boolean;
  canSubmit: boolean;
  progressMessage: string;
}

const NOTES_MAX_LENGTH = 500;

const initialFormState: UnifiedFormState = {
  images: [],
  name: "",
  notes: "",
  speciesId: "",
  styleId: "",
  acquiredAt: "",
  estimatedAge: "",
  height: "",
  width: "",
  potDetails: "",
  isPublic: true,
};

/**
 * Get human-readable progress message
 */
function getProgressMessage(
  progress: SubmitProgress,
  uploadProgress: UploadProgress
): string {
  switch (progress) {
    case "idle":
      return "";
    case "resizing":
      return "画像を最適化中...";
    case "creating":
      return "盆栽を登録中...";
    case "uploading":
      return `画像をアップロード中 (${uploadProgress.current}/${uploadProgress.total})...`;
    case "complete":
      return "登録完了！";
    case "error":
      return "エラーが発生しました";
    default:
      return "";
  }
}

/**
 * Unified Bonsai Form Hook
 *
 * Combines functionality of:
 * - useBonsaiForm (detailed form fields, validation)
 * - useQuickAddBonsai (2-stage submission: create → upload images)
 *
 * Features:
 * - Multiple image support (up to maxImages)
 * - Progressive form with optional details
 * - Client-side image resizing
 * - Progress tracking for multi-image upload
 */
export function useUnifiedBonsaiForm({
  csrfToken,
  onSuccess,
  maxImages = 5,
}: UseUnifiedBonsaiFormProps): UseUnifiedBonsaiFormReturn {
  const [formState, setFormState] =
    useState<UnifiedFormState>(initialFormState);
  const [errors, setErrors] = useState<UnifiedFormErrors>({});
  const [progress, setProgress] = useState<SubmitProgress>("idle");
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    current: 0,
    total: 0,
  });

  // Individual field setters
  const setImages = useCallback(
    (images: File[]) => {
      setFormState((prev) => ({ ...prev, images: images.slice(0, maxImages) }));
      setErrors((prev) => ({ ...prev, images: undefined }));
    },
    [maxImages]
  );

  const setName = useCallback((name: string) => {
    setFormState((prev) => ({ ...prev, name }));
    setErrors((prev) => ({ ...prev, name: undefined }));
  }, []);

  const setNotes = useCallback((notes: string) => {
    if (notes.length <= NOTES_MAX_LENGTH) {
      setFormState((prev) => ({ ...prev, notes }));
      setErrors((prev) => ({ ...prev, notes: undefined }));
    }
  }, []);

  const setSpeciesId = useCallback((speciesId: string) => {
    setFormState((prev) => ({ ...prev, speciesId }));
  }, []);

  const setStyleId = useCallback((styleId: string) => {
    setFormState((prev) => ({ ...prev, styleId }));
  }, []);

  const setAcquiredAt = useCallback((acquiredAt: string) => {
    setFormState((prev) => ({ ...prev, acquiredAt }));
    setErrors((prev) => ({ ...prev, acquiredAt: undefined }));
  }, []);

  const setEstimatedAge = useCallback((estimatedAge: string) => {
    setFormState((prev) => ({ ...prev, estimatedAge }));
    setErrors((prev) => ({ ...prev, estimatedAge: undefined }));
  }, []);

  const setHeight = useCallback((height: string) => {
    setFormState((prev) => ({ ...prev, height }));
    setErrors((prev) => ({ ...prev, height: undefined }));
  }, []);

  const setWidth = useCallback((width: string) => {
    setFormState((prev) => ({ ...prev, width }));
    setErrors((prev) => ({ ...prev, width: undefined }));
  }, []);

  const setPotDetails = useCallback((potDetails: string) => {
    setFormState((prev) => ({ ...prev, potDetails }));
  }, []);

  const setIsPublic = useCallback((isPublic: boolean) => {
    setFormState((prev) => ({ ...prev, isPublic }));
  }, []);

  // Validation
  const validate = useCallback((): boolean => {
    const newErrors: UnifiedFormErrors = {};

    // Name is required
    if (!formState.name.trim()) {
      newErrors.name = "名前を入力してください";
    }

    // Notes length check
    if (formState.notes.length > NOTES_MAX_LENGTH) {
      newErrors.notes = `メモは${NOTES_MAX_LENGTH}文字以内で入力してください`;
    }

    // Numeric field validation (if provided)
    if (formState.estimatedAge && !/^\d+$/.test(formState.estimatedAge)) {
      newErrors.estimatedAge = "推定樹齢は数値で入力してください";
    }

    if (formState.height && !/^\d+(\.\d+)?$/.test(formState.height)) {
      newErrors.height = "高さは数値で入力してください";
    }

    if (formState.width && !/^\d+(\.\d+)?$/.test(formState.width)) {
      newErrors.width = "幅は数値で入力してください";
    }

    // Date validation (if provided) - use local timezone to avoid UTC mismatch
    if (formState.acquiredAt) {
      const date = new Date(`${formState.acquiredAt}T00:00:00`);
      if (Number.isNaN(date.getTime())) {
        newErrors.acquiredAt = "有効な日付を入力してください";
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (date > today) {
          newErrors.acquiredAt = "未来の日付は入力できません";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formState]);

  // Create bonsai via API
  const createBonsai = useCallback(async (): Promise<string | null> => {
    const payload: Record<string, unknown> = {
      name: formState.name.trim(),
      isPublic: formState.isPublic,
    };

    // Optional fields - only include if provided
    if (formState.notes.trim()) {
      payload.description = formState.notes.trim();
    }
    if (formState.speciesId) {
      payload.speciesId = formState.speciesId;
    }
    if (formState.styleId) {
      payload.styleId = formState.styleId;
    }
    if (formState.acquiredAt) {
      payload.dateAcquired = formState.acquiredAt;
    }
    if (formState.estimatedAge) {
      payload.estimatedAge = Number.parseInt(formState.estimatedAge, 10);
    }
    if (formState.height) {
      payload.height = Number.parseFloat(formState.height);
    }
    if (formState.width) {
      payload.width = Number.parseFloat(formState.width);
    }
    if (formState.potDetails?.trim()) {
      payload.potDetails = formState.potDetails.trim();
    }

    const response = await fetch("/api/bonsai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "盆栽の登録に失敗しました");
    }

    const data = await response.json();
    return data.id;
  }, [formState, csrfToken]);

  // Upload single image using PrepareResult
  const uploadImage = useCallback(
    async (bonsaiId: string, prepareResult: PrepareResult): Promise<void> => {
      const formData = new FormData();
      formData.append("image", prepareResult.blob, prepareResult.filename);

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
            "画像のアップロードに失敗しました"
        );
      }
    },
    [csrfToken]
  );

  // Main submit handler
  const handleSubmit = useCallback(async (): Promise<void> => {
    // Guard against multiple submissions
    if (
      progress === "resizing" ||
      progress === "creating" ||
      progress === "uploading"
    ) {
      return;
    }

    // Validate form
    if (!validate()) {
      return;
    }

    try {
      // Step 1: Prepare images (resize if needed)
      let preparedImages: PrepareResult[] = [];
      if (formState.images.length > 0) {
        setProgress("resizing");
        preparedImages = await Promise.all(
          formState.images.map((file) =>
            prepareImageForUpload(file, {
              maxWidth: 2048,
              maxHeight: 2048,
              quality: 0.85,
              format: "image/jpeg",
            })
          )
        );
      }

      // Step 2: Create bonsai
      setProgress("creating");
      const bonsaiId = await createBonsai();

      if (!bonsaiId) {
        throw new Error("盆栽IDが取得できませんでした");
      }

      // Step 3: Upload images (if any)
      if (preparedImages.length > 0) {
        setProgress("uploading");
        setUploadProgress({ current: 0, total: preparedImages.length });

        for (let i = 0; i < preparedImages.length; i++) {
          await uploadImage(bonsaiId, preparedImages[i]);
          setUploadProgress({ current: i + 1, total: preparedImages.length });
        }
      }

      // Complete
      setProgress("complete");
      onSuccess?.(bonsaiId);
    } catch (error) {
      setProgress("error");
      setErrors({
        general:
          error instanceof Error ? error.message : "エラーが発生しました",
      });
    }
  }, [formState, progress, validate, createBonsai, uploadImage, onSuccess]);

  // Reset form
  const resetForm = useCallback(() => {
    setFormState(initialFormState);
    setErrors({});
    setProgress("idle");
    setUploadProgress({ current: 0, total: 0 });
  }, []);

  // Derived state
  const isSubmitting =
    progress === "resizing" ||
    progress === "creating" ||
    progress === "uploading";

  const canSubmit = formState.name.trim().length > 0 && !isSubmitting;

  const progressMessage = getProgressMessage(progress, uploadProgress);

  return {
    formState,
    errors,
    progress,
    uploadProgress,
    setImages,
    setName,
    setNotes,
    setSpeciesId,
    setStyleId,
    setAcquiredAt,
    setEstimatedAge,
    setHeight,
    setWidth,
    setPotDetails,
    setIsPublic,
    handleSubmit,
    resetForm,
    isSubmitting,
    canSubmit,
    progressMessage,
  };
}
