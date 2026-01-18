import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getCurrentDatetimeLocal } from "@/lib/utils/form-helpers";
import {
  CARE_TYPES,
  type CareType,
  type UseCareLogFormOptions,
  useCareLogForm,
} from "./useCareLogForm";

/**
 * Props for CareLogForm component
 */
export interface CareLogFormProps
  extends Omit<UseCareLogFormOptions, "onSuccess"> {
  /** Class name for the form container */
  className?: string;
  /** Callback on successful submit */
  onSuccess?: () => void;
  /** Callback when cancel button is clicked */
  onCancel?: () => void;
}

/**
 * Field error message component
 */
function FieldError({
  id,
  message,
}: {
  id: string;
  message: string | undefined;
}) {
  if (!message) return null;

  return (
    <p id={id} role="alert" className="text-sm text-destructive mt-1">
      {message}
    </p>
  );
}

/**
 * CareLogForm - Form for creating care logs
 *
 * Features:
 * - Care type dropdown with Japanese labels
 * - Datetime input with future date validation
 * - Optional description field
 * - Accessible form with proper labeling
 */
export function CareLogForm({
  className,
  bonsaiId,
  csrfToken,
  onSuccess,
  onCancel,
}: CareLogFormProps) {
  const formId = useId();

  const {
    formData,
    setField,
    errors,
    validateField,
    clearError,
    isSubmitting,
    submitError,
    handleSubmit,
    canSubmit,
  } = useCareLogForm({
    bonsaiId,
    csrfToken,
    onSuccess,
  });

  // Generate unique IDs for accessibility
  const careTypeId = `${formId}-careType`;
  const performedAtId = `${formId}-performedAt`;
  const descriptionId = `${formId}-description`;

  const careTypeErrorId = `${careTypeId}-error`;
  const performedAtErrorId = `${performedAtId}-error`;
  const descriptionErrorId = `${descriptionId}-error`;

  const maxDatetime = getCurrentDatetimeLocal();

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("space-y-6", className)}
      aria-label="お手入れ記録フォーム"
    >
      {/* Submit Error */}
      {submitError && (
        <div
          role="alert"
          className="rounded-lg bg-destructive/10 p-4 text-destructive"
        >
          {submitError}
        </div>
      )}

      {/* Care Type */}
      <div className="space-y-2">
        <Label htmlFor={careTypeId}>
          お手入れの種類 <span className="text-destructive">*</span>
        </Label>
        <Select
          value={formData.careType}
          onValueChange={(value) => {
            setField("careType", value as CareType);
            clearError("careType");
          }}
        >
          <SelectTrigger
            id={careTypeId}
            aria-required="true"
            aria-invalid={!!errors.careType}
            aria-describedby={errors.careType ? careTypeErrorId : undefined}
          >
            <SelectValue placeholder="種類を選択" />
          </SelectTrigger>
          <SelectContent>
            {CARE_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError id={careTypeErrorId} message={errors.careType} />
      </div>

      {/* Performed At */}
      <div className="space-y-2">
        <Label htmlFor={performedAtId}>
          実施日時 <span className="text-destructive">*</span>
        </Label>
        <Input
          id={performedAtId}
          type="datetime-local"
          value={formData.performedAt}
          onChange={(e) => {
            setField("performedAt", e.target.value);
            clearError("performedAt");
          }}
          onBlur={() => validateField("performedAt")}
          onFocus={(e) => {
            e.currentTarget.max = getCurrentDatetimeLocal();
          }}
          max={maxDatetime}
          aria-required="true"
          aria-invalid={!!errors.performedAt}
          aria-describedby={errors.performedAt ? performedAtErrorId : undefined}
        />
        <FieldError id={performedAtErrorId} message={errors.performedAt} />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={descriptionId}>メモ</Label>
          <span className="text-xs text-muted-foreground">
            {formData.description.length}/1000
          </span>
        </div>
        <Textarea
          id={descriptionId}
          value={formData.description}
          onChange={(e) => {
            setField("description", e.target.value);
            clearError("description");
          }}
          onBlur={() => validateField("description")}
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? descriptionErrorId : undefined}
          placeholder="作業内容や気づいたことなど"
          rows={4}
          maxLength={1000}
        />
        <FieldError id={descriptionErrorId} message={errors.description} />
      </div>

      {/* Form Actions */}
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
        <Button type="submit" disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? "保存中..." : "記録を追加"}
        </Button>
      </div>
    </form>
  );
}
