/**
 * Settings Page Component
 *
 * Main component for the settings page with tabs for settings and audit logs.
 */

import { useState } from "react";

import { AuditLogList } from "./AuditLogList";
import { SettingsForm } from "./SettingsForm";

interface SettingsPageProps {
  csrfToken: string | null;
}

type Tab = "settings" | "audit";

export function SettingsPage({ csrfToken }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>("settings");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">設定</h1>
        <p className="text-sm text-muted-foreground">システム設定と監査ログ</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="-mb-px flex gap-4" role="tablist" aria-label="設定タブ">
          <button
            type="button"
            role="tab"
            id="settings-tab"
            aria-selected={activeTab === "settings"}
            aria-controls="settings-panel"
            tabIndex={activeTab === "settings" ? 0 : -1}
            onClick={() => setActiveTab("settings")}
            className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
              activeTab === "settings"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            システム設定
          </button>
          <button
            type="button"
            role="tab"
            id="audit-tab"
            aria-selected={activeTab === "audit"}
            aria-controls="audit-panel"
            tabIndex={activeTab === "audit" ? 0 : -1}
            onClick={() => setActiveTab("audit")}
            className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
              activeTab === "audit"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            監査ログ
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div
        role="tabpanel"
        id="settings-panel"
        aria-labelledby="settings-tab"
        hidden={activeTab !== "settings"}
      >
        {activeTab === "settings" && <SettingsForm csrfToken={csrfToken} />}
      </div>
      <div
        role="tabpanel"
        id="audit-panel"
        aria-labelledby="audit-tab"
        hidden={activeTab !== "audit"}
      >
        {activeTab === "audit" && <AuditLogList />}
      </div>
    </div>
  );
}
