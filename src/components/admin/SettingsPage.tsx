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
        <nav className="-mb-px flex gap-4">
          <button
            type="button"
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
            onClick={() => setActiveTab("audit")}
            className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
              activeTab === "audit"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            監査ログ
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "settings" && <SettingsForm csrfToken={csrfToken} />}
      {activeTab === "audit" && <AuditLogList />}
    </div>
  );
}
