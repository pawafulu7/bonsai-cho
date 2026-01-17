import { useCallback, useEffect, useState } from "react";
import type {
  UseProfileOptions,
  UseProfileReturn,
  UserProfile,
} from "@/types/user";

/**
 * useProfile - Custom hook for fetching user profile
 *
 * Features:
 * - Initial data support for SSR
 * - Loading and error states
 * - Refetch capability
 */
export function useProfile({
  userId,
  initialData,
}: UseProfileOptions): UseProfileReturn {
  const [profile, setProfile] = useState<UserProfile | null>(
    initialData ?? null
  );
  const [isLoading, setIsLoading] = useState(!initialData);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/users/${userId}`, {
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("User not found");
        }
        throw new Error("Failed to fetch profile");
      }

      const data = await response.json();
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Fetch on mount if no initial data, or when userId changes with stale data
  useEffect(() => {
    if (!initialData || initialData.id !== userId) {
      fetchProfile();
    }
  }, [initialData, userId, fetchProfile]);

  const refetch = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    isLoading,
    error,
    refetch,
  };
}
