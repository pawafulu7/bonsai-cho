/**
 * Settings Form Component
 *
 * Form for viewing and updating system settings.
 */

import { Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SettingItem {
  key: string;
  value: string;
  description: string | null;
  updatedAt: string;
  updatedBy: string | null;
  updatedByName: string | null;
}

interface SettingsFormProps {
  csrfToken: string | null;
}

const settingLabels: Record<string, string> = {
  registration_enabled: "新規ユーザー登録",
  maintenance_mode: "メンテナンスモード",
  maintenance_message: "メンテナンスメッセージ",
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SettingsForm({ csrfToken }: SettingsFormProps) {
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/settings", {
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "設定の取得に失敗しました");
      }

      const data = await res.json();
      setSettings(data.data);

      // Initialize edited values
      const values: Record<string, string> = {};
      for (const setting of data.data) {
        values[setting.key] = setting.value;
      }
      setEditedValues(values);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "データの取得に失敗しました"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Handle value change
  const handleValueChange = (key: string, value: string) => {
    setEditedValues((prev) => ({ ...prev, [key]: value }));
    setSuccessMessage(null);
  };

  // Save a setting
  const saveSetting = async (key: string) => {
    if (!csrfToken) {
      setError("CSRF token not found. Please refresh the page.");
      return;
    }

    const originalSetting = settings.find((s) => s.key === key);
    const newValue = editedValues[key];

    // Skip if value hasn't changed
    if (originalSetting?.value === newValue) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/admin/settings/${key}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ value: newValue }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "設定の保存に失敗しました");
      }

      setSuccessMessage(`${settingLabels[key] || key} を更新しました`);

      // Refresh settings to get updated timestamps
      await fetchSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "設定の保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="rounded-lg border border-green-500/50 bg-green-50 p-4">
          <p className="text-sm text-green-700">{successMessage}</p>
        </div>
      )}

      {/* Settings */}
      <div className="space-y-4">
        {settings.map((setting) => {
          const isBoolean =
            setting.value === "true" || setting.value === "false";
          const currentValue = editedValues[setting.key] || setting.value;
          const hasChanged = setting.value !== editedValues[setting.key];

          return (
            <div
              key={setting.key}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <label
                    htmlFor={`setting-${setting.key}`}
                    className="block text-sm font-medium text-foreground"
                  >
                    {settingLabels[setting.key] || setting.key}
                  </label>
                  {setting.description && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {setting.description}
                    </p>
                  )}
                </div>

                {isBoolean ? (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      id={`setting-${setting.key}`}
                      role="switch"
                      aria-checked={currentValue === "true"}
                      onClick={() =>
                        handleValueChange(
                          setting.key,
                          currentValue === "true" ? "false" : "true"
                        )
                      }
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        currentValue === "true" ? "bg-primary" : "bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          currentValue === "true"
                            ? "translate-x-6"
                            : "translate-x-1"
                        )}
                      />
                    </button>
                    {hasChanged && (
                      <Button
                        size="sm"
                        onClick={() => saveSetting(setting.key)}
                        disabled={isSaving}
                      >
                        <Save className="mr-1 h-3 w-3" />
                        保存
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      id={`setting-${setting.key}`}
                      type="text"
                      value={currentValue}
                      onChange={(e) =>
                        handleValueChange(setting.key, e.target.value)
                      }
                      className="h-9 w-64 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {hasChanged && (
                      <Button
                        size="sm"
                        onClick={() => saveSetting(setting.key)}
                        disabled={isSaving}
                      >
                        <Save className="mr-1 h-3 w-3" />
                        保存
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Last updated info */}
              {setting.updatedByName && (
                <p className="mt-3 text-xs text-muted-foreground">
                  最終更新: {formatDate(setting.updatedAt)} by{" "}
                  {setting.updatedByName}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
