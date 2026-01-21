/**
 * Mobile Navigation Component
 *
 * Slide-out navigation drawer for mobile devices.
 */

import {
  LayoutDashboard,
  type LucideIcon,
  Settings,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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

interface MobileNavProps {
  currentPath: string;
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNav({ currentPath, isOpen, onClose }: MobileNavProps) {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          aria-label="メニューを閉じる"
        />
      )}

      {/* Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform bg-card transition-transform duration-200 ease-in-out md:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            <a href="/manage" className="flex items-center gap-2">
              <span className="font-serif text-lg font-semibold text-primary">
                盆栽帳
              </span>
              <span className="text-xs text-muted-foreground">管理</span>
            </a>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="メニューを閉じる"
            >
              <X className="h-5 w-5" />
            </Button>
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
                  onClick={onClose}
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
    </>
  );
}
