/**
 * Admin Sidebar Component
 *
 * Navigation sidebar for the admin dashboard.
 * Provides links to dashboard, users, and settings pages.
 */

import {
  LayoutDashboard,
  type LucideIcon,
  Settings,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  {
    label: "ダッシュボード",
    href: "/manage",
    icon: LayoutDashboard,
  },
  {
    label: "ユーザー管理",
    href: "/manage/users",
    icon: Users,
  },
  {
    label: "設定",
    href: "/manage/settings",
    icon: Settings,
  },
];

interface AdminSidebarProps {
  currentPath: string;
}

export function AdminSidebar({ currentPath }: AdminSidebarProps) {
  return (
    <aside className="hidden w-64 flex-shrink-0 border-r border-border bg-card md:block">
      <div className="flex h-full flex-col">
        {/* Logo / Title */}
        <div className="flex h-16 items-center border-b border-border px-6">
          <a href="/manage" className="flex items-center gap-2">
            <span className="font-serif text-lg font-semibold text-primary">
              盆栽帳
            </span>
            <span className="text-xs text-muted-foreground">管理</span>
          </a>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const isActive =
              currentPath === item.href ||
              (item.href !== "/manage" && currentPath.startsWith(item.href));
            const Icon = item.icon;

            return (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Back to site link */}
        <div className="border-t border-border p-4">
          <a
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <span>← サイトに戻る</span>
          </a>
        </div>
      </div>
    </aside>
  );
}
