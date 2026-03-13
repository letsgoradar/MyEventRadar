import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

const SESSION_KEY = "letsgo_hidden_events";
let modalShown = false;

export function useHiddenEvents() {
  const { user } = useAuth();
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    if (user) {
      apiRequest("/api/hidden-events").then((data: number[]) => {
        setHiddenIds(prev => {
          const merged = new Set([...prev, ...data]);
          sessionStorage.setItem(SESSION_KEY, JSON.stringify([...merged]));
          return merged;
        });
      }).catch(() => {});
    }
  }, [user]);

  const persistToSession = useCallback((ids: Set<number>) => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([...ids]));
  }, []);

  const hideEvent = useCallback((eventId: number) => {
    if (!user && !modalShown) {
      setShowLoginModal(true);
      modalShown = true;
    }

    setHiddenIds(prev => {
      const next = new Set(prev);
      next.add(eventId);
      persistToSession(next);
      return next;
    });

    if (user) {
      apiRequest(`/api/events/${eventId}/hide`, { method: "POST" }).catch(() => {});
    }
  }, [user, persistToSession]);

  const unhideEvent = useCallback((eventId: number) => {
    setHiddenIds(prev => {
      const next = new Set(prev);
      next.delete(eventId);
      persistToSession(next);
      return next;
    });

    if (user) {
      apiRequest(`/api/events/${eventId}/hide`, { method: "DELETE" }).catch(() => {});
    }
  }, [user, persistToSession]);

  const isHidden = useCallback((eventId: number) => {
    return hiddenIds.has(eventId);
  }, [hiddenIds]);

  const dismissLoginModal = useCallback(() => {
    setShowLoginModal(false);
  }, []);

  return {
    hiddenIds,
    hideEvent,
    unhideEvent,
    isHidden,
    showLoginModal,
    dismissLoginModal,
  };
}
