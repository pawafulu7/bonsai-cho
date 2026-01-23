/**
 * Admin Login Form Component
 *
 * Email/password login form for admin users.
 * Handles authentication via API and redirects on success.
 */

import { AlertCircle, Loader2, Lock, Mail } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AdminLoginFormProps {
  returnTo?: string;
}

export function AdminLoginForm({ returnTo = "/manage" }: AdminLoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle error response
        switch (data.code) {
          case "INVALID_CREDENTIALS":
            setError("メールアドレスまたはパスワードが正しくありません");
            break;
          case "ACCOUNT_LOCKED":
            setError(
              `アカウントがロックされています。${data.lockoutRemaining}分後に再試行してください`
            );
            break;
          case "ACCOUNT_DISABLED":
            setError("このアカウントは無効化されています");
            break;
          case "TOTP_REQUIRED":
            // Future: redirect to 2FA verification page
            setError("2要素認証が有効です（現在未対応）");
            break;
          default:
            setError(data.error || "ログインに失敗しました");
        }
        setIsLoading(false);
        return;
      }

      // Success - redirect to return URL
      window.location.href = returnTo;
    } catch (err) {
      console.error("Login error:", err);
      setError("ネットワークエラーが発生しました。再度お試しください。");
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">メールアドレス</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            placeholder="admin@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            className="pl-10"
            autoComplete="email"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">パスワード</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
            className="pl-10"
            autoComplete="current-password"
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ログイン中...
          </>
        ) : (
          "ログイン"
        )}
      </Button>
    </form>
  );
}
