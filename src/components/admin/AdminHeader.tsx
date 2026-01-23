/**
 * Admin Header Component
 *
 * Header for the admin dashboard with mobile menu toggle and user info.
 */

import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface AdminHeaderProps {
  user: AdminUser;
  onMenuToggle?: () => void;
}

export function AdminHeader({ user, onMenuToggle }: AdminHeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-6">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenuToggle}
        aria-label="メニューを開く"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Title (visible on mobile) */}
      <div className="flex items-center gap-2 md:hidden">
        <span className="font-serif text-lg font-semibold text-primary">
          盆栽帳
        </span>
        <span className="text-xs text-muted-foreground">管理</span>
      </div>

      {/* Spacer for desktop */}
      <div className="hidden md:block" />

      {/* User info */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{user.name}</span>
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="h-8 w-8 rounded-full"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </header>
  );
}
