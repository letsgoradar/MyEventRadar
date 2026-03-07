import { useState, useEffect } from "react";
import { X, MessageSquarePlus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const STORAGE_KEY = "letsgo-beta-notice-date";

export function BetaBanner() {
  const [visible, setVisible] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const lastShown = localStorage.getItem(STORAGE_KEY);
    if (lastShown !== today) {
      setVisible(true);
    }
  }, [user]);

  if (!visible) return null;

  const handleDismiss = () => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(STORAGE_KEY, today);
    setVisible(false);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-primary text-primary-foreground">
      <div className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs sm:text-sm">
        <span className="font-bold bg-white/20 rounded px-1.5 py-0.5 text-[10px] tracking-wider">BETA</span>
        <span className="hidden sm:inline">Dit is een beta-versie — we werken hard aan verbeteringen. Je feedback is welkom!</span>
        <span className="sm:hidden">Beta-versie — feedback welkom!</span>
        <MessageSquarePlus className="w-3.5 h-3.5 shrink-0" />
        <button
          onClick={handleDismiss}
          className="ml-1 p-0.5 rounded hover:bg-white/20 transition-colors"
          aria-label="Sluiten"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
