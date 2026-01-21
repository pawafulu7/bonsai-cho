/**
 * Admin Layout Client Component
 *
 * Client-side wrapper for the admin layout that handles
 * mobile navigation state.
 */

import { useState } from "react";

import { AdminHeader } from "./AdminHeader";
import { AdminSidebar } from "./AdminSidebar";
import { MobileNav } from "./MobileNav";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface AdminLayoutClientProps {
  currentPath: string;
  user: AdminUser;
  children: React.ReactNode;
}

export function AdminLayoutClient({
  currentPath,
  user,
  children,
}: AdminLayoutClientProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <AdminSidebar currentPath={currentPath} />

      {/* Mobile Navigation */}
      <MobileNav
        currentPath={currentPath}
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
      />

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        <AdminHeader
          user={user}
          onMenuToggle={() => setIsMobileNavOpen(true)}
        />

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
