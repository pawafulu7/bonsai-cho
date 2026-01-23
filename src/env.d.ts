/// <reference path="../.astro/types.d.ts" />

import type { AdminSessionUser } from "@/lib/auth/admin-session";
import type { SessionUser } from "@/lib/auth/session";

declare global {
  namespace App {
    interface Locals {
      // Regular user (OAuth authentication)
      user?: SessionUser;
      // Admin user (password authentication)
      adminUser?: AdminSessionUser;
      isAdmin?: boolean;
    }
  }
}
