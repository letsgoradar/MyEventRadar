import { useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";

export type MapStyle = 'default' | 'satellite' | 'minimal';

export interface UserPreferences {
  defaultRadius: number;
  defaultWindowDays: number;
  mapStyle: MapStyle;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  defaultRadius: 20,
  defaultWindowDays: 100,
  mapStyle: 'default',
};

export function useUserPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const preferences: UserPreferences = useMemo(() => {
    if (!user) return DEFAULT_PREFERENCES;
    const stored = (user as any).preferences as Partial<UserPreferences> | null;
    if (!stored) return DEFAULT_PREFERENCES;
    return {
      defaultRadius: stored.defaultRadius ?? DEFAULT_PREFERENCES.defaultRadius,
      defaultWindowDays: stored.defaultWindowDays ?? DEFAULT_PREFERENCES.defaultWindowDays,
      mapStyle: stored.mapStyle ?? DEFAULT_PREFERENCES.mapStyle,
    };
  }, [user]);

  const updatePreferences = useCallback(async (partial: Partial<UserPreferences>) => {
    if (!user) return;
    const updated = { ...preferences, ...partial };
    await apiRequest("/api/user/preferences", {
      method: "PATCH",
      data: updated,
    });
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    queryClient.invalidateQueries({ queryKey: ["/api/user"] });
  }, [user, preferences, queryClient]);

  return {
    preferences,
    updatePreferences,
    isAuthenticated: !!user,
  };
}
