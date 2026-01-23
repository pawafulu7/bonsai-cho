/// <reference path="../.astro/types.d.ts" />

import type { SessionUser } from "@/lib/auth/session";

declare global {
  namespace App {
    interface Locals {
      user?: SessionUser;
      isAdmin?: boolean;
    }
  }
}
