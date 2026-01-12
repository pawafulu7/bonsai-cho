/**
 * Auth Header Component
 *
 * Displays login button or user menu based on authentication state.
 * Used in the main header/navigation.
 */

import { Button } from "@/components/ui/button";
import { UserMenu } from "./UserMenu";

interface User {
  id: string;
  email: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface AuthHeaderProps {
  user: User | null;
  csrfToken?: string;
  loginReturnTo?: string;
}

export function AuthHeader({
  user,
  csrfToken,
  loginReturnTo = "/",
}: AuthHeaderProps) {
  if (user) {
    return <UserMenu user={user} csrfToken={csrfToken} />;
  }

  return (
    <Button variant="outline" size="sm" asChild>
      <a href={`/login?returnTo=${encodeURIComponent(loginReturnTo)}`}>
        ログイン
      </a>
    </Button>
  );
}
