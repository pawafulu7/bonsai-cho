import { useCallback, useMemo, useState } from "react";
import {
  dateToISO,
  formatNumericValue,
  isFutureDate,
  isoToDate,
  parseNumericInput,
} from "@/lib/utils/form-helpers";
import type { BonsaiDetailResponse } from "@/server/routes/bonsai.schema";

/**
 * Species type from Masters API
 */
export interface Species {
  id: string;
  nameJa: string;
  nameEn: string | null;
  nameScientific: string | null;
  description: string | null;
}

/**
 * Style type from Masters API
 */
export interface Style {
  id: string;
  nameJa: string;
  nameEn: string | null;
  description: string | null;
}

/**
 * Form data structure (string values for controlled inputs)
 */
export interface BonsaiFormData {
  name: string;
  description: string;
  speciesId: string;
  styleId: string;
  acquiredAt: string; // YYYY-MM-DD format for input
  estimatedAge: string;
  height: string;
  width: string;
  potDetails: string;
  isPublic: boolean;
}

/**
 * Type-safe error record for form fields
 */
export type BonsaiFormErrors = Partial<Record<keyof BonsaiFormData, string>>;

/**
 * Options for useBonsaiForm hook
 */
export interface UseBonsaiFormOptions {
  /** Initial data for edit mode */
  initialData?: BonsaiDetailResponse;
  /** CSRF token for API requests */
  csrfToken: string;
  /** Callback on successful submit */
  onSuccess?: (bonsaiId: string) => void;
}

/**
 * Return type for useBonsaiForm hook
 */
export interface UseBonsaiFormReturn {
  // Form state
  formData: BonsaiFormData;
  setField: <K extends keyof BonsaiFormData>(
    field: K,
    value: BonsaiFormData[K]
  ) => void;

  // Validation
  errors: BonsaiFormErrors;
  validateField: (field: keyof BonsaiFormData) => void;
  validateAll: () => boolean;
  clearError: (field: keyof BonsaiFormData) => void;

  // Submission
  isSubmitting: boolean;
  submitError: string | null;
  handleSubmit: (e: React.FormEvent) => Promise<void>;

  // Derived state
  isEditMode: boolean;
  isDirty: boolean;
  canSubmit: boolean;
}

/**
 * Initialize form data from BonsaiDetailResponse or empty state
 */
function initializeFormData(
  initialData?: BonsaiDetailResponse
): BonsaiFormData {
  if (!initialData) {
    return {
      name: "",
      description: "",
      speciesId: "",
      styleId: "",
      acquiredAt: "",
      estimatedAge: "",
      height: "",
      width: "",
      potDetails: "",
      isPublic: true,
    };
  }

  return {
    name: initialData.name,
    description: initialData.description || "",
    speciesId: initialData.speciesId || "",
    styleId: initialData.styleId || "",
    acquiredAt: isoToDate(initialData.acquiredAt),
    estimatedAge: formatNumericValue(initialData.estimatedAge),
    height: formatNumericValue(initialData.height),
    width: formatNumericValue(initialData.width),
    potDetails: initialData.potDetails || "",
    isPublic: initialData.isPublic,
  };
}

/**
 * Validate a single field
 */
function validateSingleField(
  field: keyof BonsaiFormData,
  value: BonsaiFormData[keyof BonsaiFormData]
): string | null {
  switch (field) {
    case "name": {
      const strValue = value as string;
      if (!strValue.trim()) {
        return "盆栽の名前は必須です";
      }
      if (strValue.length > 100) {
        return "名前は100文字以内で入力してください";
      }
      return null;
    }

    case "description": {
      const strValue = value as string;
      if (strValue.length > 2000) {
        return "説明は2000文字以内で入力してください";
      }
      return null;
    }

    case "acquiredAt": {
      const strValue = value as string;
      if (strValue && isFutureDate(strValue)) {
        return "入手日は未来の日付を指定できません";
      }
      return null;
    }

    case "estimatedAge": {
      const strValue = value as string;
      if (strValue) {
        const num = parseNumericInput(strValue);
        if (num === null) {
          return "推定樹齢は数値で入力してください";
        }
        if (num < 0 || num > 1000) {
          return "推定樹齢は0〜1000の範囲で入力してください";
        }
      }
      return null;
    }

    case "height": {
      const strValue = value as string;
      if (strValue) {
        const num = parseNumericInput(strValue);
        if (num === null) {
          return "高さは数値で入力してください";
        }
        if (num <= 0 || num > 500) {
          return "高さは0より大きく500cm以下で入力してください";
        }
      }
      return null;
    }

    case "width": {
      const strValue = value as string;
      if (strValue) {
        const num = parseNumericInput(strValue);
        if (num === null) {
          return "幅は数値で入力してください";
        }
        if (num <= 0 || num > 500) {
          return "幅は0より大きく500cm以下で入力してください";
        }
      }
      return null;
    }

    case "potDetails": {
      const strValue = value as string;
      if (strValue.length > 500) {
        return "鉢の詳細は500文字以内で入力してください";
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * API payload type for bonsai
 */
interface BonsaiPayload {
  name: string;
  description: string | null;
  speciesId: string | null;
  styleId: string | null;
  acquiredAt: string | null;
  estimatedAge: number | null;
  height: number | null;
  width: number | null;
  potDetails: string | null;
  isPublic: boolean;
}

/**
 * Convert form data to API payload
 */
function formDataToPayload(formData: BonsaiFormData): BonsaiPayload {
  return {
    name: formData.name.trim(),
    description: formData.description.trim() || null,
    speciesId: formData.speciesId || null,
    styleId: formData.styleId || null,
    acquiredAt: dateToISO(formData.acquiredAt),
    estimatedAge: parseNumericInput(formData.estimatedAge),
    height: parseNumericInput(formData.height),
    width: parseNumericInput(formData.width),
    potDetails: formData.potDetails.trim() || null,
    isPublic: formData.isPublic,
  };
}

/**
 * Normalize form data for comparison (trim strings)
 * This ensures isDirty and getChangedFields use the same comparison logic
 */
function normalizeFormDataForComparison(
  formData: BonsaiFormData
): BonsaiFormData {
  return {
    name: formData.name.trim(),
    description: formData.description.trim(),
    speciesId: formData.speciesId,
    styleId: formData.styleId,
    acquiredAt: formData.acquiredAt,
    estimatedAge: formData.estimatedAge.trim(),
    height: formData.height.trim(),
    width: formData.width.trim(),
    potDetails: formData.potDetails.trim(),
    isPublic: formData.isPublic,
  };
}

/**
 * Get only changed fields for PATCH request
 */
function getChangedFields(
  formData: BonsaiFormData,
  initialData: BonsaiDetailResponse
): Partial<BonsaiPayload> | null {
  const payload = formDataToPayload(formData);
  const changes: Partial<BonsaiPayload> = {};

  // Compare each field
  if (payload.name !== initialData.name) {
    changes.name = payload.name;
  }
  if (payload.description !== initialData.description) {
    changes.description = payload.description;
  }
  if (payload.speciesId !== initialData.speciesId) {
    changes.speciesId = payload.speciesId;
  }
  if (payload.styleId !== initialData.styleId) {
    changes.styleId = payload.styleId;
  }
  if (payload.acquiredAt !== initialData.acquiredAt) {
    changes.acquiredAt = payload.acquiredAt;
  }
  if (payload.estimatedAge !== initialData.estimatedAge) {
    changes.estimatedAge = payload.estimatedAge;
  }
  if (payload.height !== initialData.height) {
    changes.height = payload.height;
  }
  if (payload.width !== initialData.width) {
    changes.width = payload.width;
  }
  if (payload.potDetails !== initialData.potDetails) {
    changes.potDetails = payload.potDetails;
  }
  if (payload.isPublic !== initialData.isPublic) {
    changes.isPublic = payload.isPublic;
  }

  return Object.keys(changes).length > 0 ? changes : null;
}

/**
 * Custom hook for managing bonsai form state
 */
export function useBonsaiForm({
  initialData,
  csrfToken,
  onSuccess,
}: UseBonsaiFormOptions): UseBonsaiFormReturn {
  const isEditMode = !!initialData;

  // Form state
  const [formData, setFormData] = useState<BonsaiFormData>(() =>
    initializeFormData(initialData)
  );
  const [errors, setErrors] = useState<BonsaiFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Check if form has been modified (using normalized/trimmed values)
  const isDirty = useMemo(() => {
    if (!initialData) return true; // New form is always "dirty"

    const initial = initializeFormData(initialData);
    const normalizedInitial = normalizeFormDataForComparison(initial);
    const normalizedCurrent = normalizeFormDataForComparison(formData);

    return (
      normalizedCurrent.name !== normalizedInitial.name ||
      normalizedCurrent.description !== normalizedInitial.description ||
      normalizedCurrent.speciesId !== normalizedInitial.speciesId ||
      normalizedCurrent.styleId !== normalizedInitial.styleId ||
      normalizedCurrent.acquiredAt !== normalizedInitial.acquiredAt ||
      normalizedCurrent.estimatedAge !== normalizedInitial.estimatedAge ||
      normalizedCurrent.height !== normalizedInitial.height ||
      normalizedCurrent.width !== normalizedInitial.width ||
      normalizedCurrent.potDetails !== normalizedInitial.potDetails ||
      normalizedCurrent.isPublic !== normalizedInitial.isPublic
    );
  }, [formData, initialData]);

  // Check if form can be submitted
  const canSubmit = useMemo(() => {
    if (isSubmitting) return false;
    if (!isDirty) return false;
    if (!formData.name.trim()) return false;
    if (Object.keys(errors).length > 0) return false;
    return true;
  }, [isSubmitting, isDirty, formData.name, errors]);

  // Set a single field value
  const setField = useCallback(
    <K extends keyof BonsaiFormData>(field: K, value: BonsaiFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setSubmitError(null);
    },
    []
  );

  // Validate a single field (using formData from dependency)
  const validateField = useCallback(
    (field: keyof BonsaiFormData) => {
      const error = validateSingleField(field, formData[field]);
      setErrors((prev) => {
        const currentError = prev[field];
        // Skip update if error state hasn't changed
        if (error === currentError) return prev;
        if (!error && !currentError) return prev;

        if (error) {
          return { ...prev, [field]: error };
        }
        const { [field]: _, ...rest } = prev;
        return rest;
      });
    },
    [formData]
  );

  // Clear error for a field
  const clearError = useCallback((field: keyof BonsaiFormData) => {
    setErrors((prev) => {
      const { [field]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  // Validate all fields
  const validateAll = useCallback((): boolean => {
    const newErrors: BonsaiFormErrors = {};
    const fields: (keyof BonsaiFormData)[] = [
      "name",
      "description",
      "acquiredAt",
      "estimatedAge",
      "height",
      "width",
      "potDetails",
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

      // For edit mode, check if there are changes
      if (initialData && !isDirty) {
        return;
      }

      setIsSubmitting(true);

      try {
        let url: string;
        let method: string;
        let body: BonsaiPayload | Partial<BonsaiPayload>;

        if (isEditMode && initialData) {
          // Edit mode: PATCH with only changed fields
          url = `/api/bonsai/${initialData.id}`;
          method = "PATCH";
          const changes = getChangedFields(formData, initialData);
          if (!changes) {
            setIsSubmitting(false);
            return;
          }
          body = changes;
        } else {
          // Create mode: POST with all fields
          url = "/api/bonsai";
          method = "POST";
          body = formDataToPayload(formData);
        }

        const response = await fetch(url, {
          method,
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

        // Only parse JSON if there's content (handle 204 No Content for PATCH)
        let bonsaiId: string;
        const contentType = response.headers.get("Content-Type");
        if (
          response.status !== 204 &&
          contentType?.includes("application/json")
        ) {
          const result = await response.json();
          bonsaiId = isEditMode ? initialData!.id : result.id;
        } else {
          // For PATCH with no content, use the existing ID
          bonsaiId = initialData!.id;
        }

        if (onSuccess) {
          onSuccess(bonsaiId);
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
    [
      validateAll,
      initialData,
      isDirty,
      isEditMode,
      formData,
      csrfToken,
      onSuccess,
    ]
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
    isEditMode,
    isDirty,
    canSubmit,
  };
}
