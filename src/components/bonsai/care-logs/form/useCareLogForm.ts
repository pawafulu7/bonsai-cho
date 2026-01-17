import { useCallback, useMemo, useState } from "react";
import {
  datetimeLocalToISO,
  isoToDatetimeLocal,
  getCurrentDatetimeLocal,
  isFutureDate,
} from "@/lib/utils/form-helpers";

/**
 * Care type options
 */
export const CARE_TYPES = [
  { value: "watering", label: "水やり" },
  { value: "fertilizing", label: "施肥" },
  { value: "pruning", label: "剪定" },
  { value: "repotting", label: "植替え" },
  { value: "wiring", label: "針金かけ" },
  { value: "other", label: "その他" },
] as const;

export type CareType = (typeof CARE_TYPES)[number]["value"];

/**
 * Form data structure (string values for controlled inputs)
 */
export interface CareLogFormData {
  careType: CareType | "";
  description: string;
  performedAt: string; // datetime-local format (YYYY-MM-DDTHH:mm)
}

/**
 * Options for useCareLogForm hook
 */
export interface UseCareLogFormOptions {
  /** Bonsai ID */
  bonsaiId: string;
  /** CSRF token for API requests */
  csrfToken: string;
  /** Callback on successful submit */
  onSuccess?: () => void;
}

/**
 * Return type for useCareLogForm hook
 */
export interface UseCareLogFormReturn {
  // Form state
  formData: CareLogFormData;
  setField: <K extends keyof CareLogFormData>(
    field: K,
    value: CareLogFormData[K]
  ) => void;

  // Validation
  errors: Record<string, string>;
  validateField: (field: keyof CareLogFormData) => void;
  validateAll: () => boolean;
  clearError: (field: keyof CareLogFormData) => void;

  // Submission
  isSubmitting: boolean;
  submitError: string | null;
  handleSubmit: (e: React.FormEvent) => Promise<void>;

  // Derived state
  canSubmit: boolean;
}

/**
 * Initialize form data with current datetime
 */
function initializeFormData(): CareLogFormData {
  return {
    careType: "",
    description: "",
    performedAt: getCurrentDatetimeLocal(),
  };
}

/**
 * Validate a single field
 */
function validateSingleField(
  field: keyof CareLogFormData,
  value: CareLogFormData[keyof CareLogFormData]
): string | null {
  switch (field) {
    case "careType": {
      const strValue = value as string;
      if (!strValue) {
        return "お手入れの種類を選択してください";
      }
      return null;
    }

    case "description": {
      const strValue = value as string;
      if (strValue.length > 1000) {
        return "説明は1000文字以内で入力してください";
      }
      return null;
    }

    case "performedAt": {
      const strValue = value as string;
      if (!strValue) {
        return "実施日時は必須です";
      }
      // Convert to ISO for validation
      const isoDate = datetimeLocalToISO(strValue);
      if (!isoDate) {
        return "有効な日時を入力してください";
      }
      if (isFutureDate(isoDate)) {
        return "実施日時は未来の日付を指定できません";
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Convert form data to API payload
 */
function formDataToPayload(formData: CareLogFormData): Record<string, unknown> {
  return {
    careType: formData.careType,
    description: formData.description.trim() || null,
    performedAt: datetimeLocalToISO(formData.performedAt),
  };
}

/**
 * Custom hook for managing care log form state
 */
export function useCareLogForm({
  bonsaiId,
  csrfToken,
  onSuccess,
}: UseCareLogFormOptions): UseCareLogFormReturn {
  // Form state
  const [formData, setFormData] = useState<CareLogFormData>(initializeFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Check if form can be submitted
  const canSubmit = useMemo(() => {
    if (isSubmitting) return false;
    if (!formData.careType) return false;
    if (!formData.performedAt) return false;
    if (Object.keys(errors).length > 0) return false;
    return true;
  }, [isSubmitting, formData.careType, formData.performedAt, errors]);

  // Set a single field value
  const setField = useCallback(
    <K extends keyof CareLogFormData>(field: K, value: CareLogFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setSubmitError(null);
    },
    []
  );

  // Validate a single field
  const validateField = useCallback((field: keyof CareLogFormData) => {
    setFormData((currentData) => {
      const error = validateSingleField(field, currentData[field]);
      setErrors((prev) => {
        if (error) {
          return { ...prev, [field]: error };
        }
        const { [field]: _, ...rest } = prev;
        return rest;
      });
      return currentData;
    });
  }, []);

  // Clear error for a field
  const clearError = useCallback((field: keyof CareLogFormData) => {
    setErrors((prev) => {
      const { [field]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  // Validate all fields
  const validateAll = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    const fields: (keyof CareLogFormData)[] = [
      "careType",
      "description",
      "performedAt",
    ];

    for (const field of fields) {
      const error = validateSingleField(field, formData[field]);
      if (error) {
        newErrors[field] = error;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);

      // Validate all fields
      if (!validateAll()) {
        return;
      }

      setIsSubmitting(true);

      try {
        const url = `/api/bonsai/${bonsaiId}/care-logs`;
        const body = formDataToPayload(formData);

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error ||
              errorData.message ||
              `API error: ${response.status}`
          );
        }

        if (onSuccess) {
          onSuccess();
        }
      } catch (error) {
        console.error("Form submission error:", error);
        setSubmitError(
          error instanceof Error
            ? error.message
            : "保存に失敗しました。もう一度お試しください。"
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [validateAll, bonsaiId, formData, csrfToken, onSuccess]
  );

  return {
    formData,
    setField,
    errors,
    validateField,
    validateAll,
    clearError,
    isSubmitting,
    submitError,
    handleSubmit,
    canSubmit,
  };
}
