import { useState, useEffect } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "letsgo-beta-banner-dismissed";

export function BetaBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) setDismissed(false);
  }, []);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, "1");
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-blue-600 to-purple-600 text-white">
      <div className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs sm:text-sm">
        <span className="font-bold bg-white/20 rounded px-1.5 py-0.5 text-[10px] tracking-wider">BETA</span>
        <span className="hidden sm:inline">We zijn nog in ontwikkeling — je feedback helpt ons verbeteren!</span>
        <span className="sm:hidden">Help ons verbeteren met je feedback!</span>
        <button
          onClick={handleDismiss}
          className="ml-2 p-0.5 rounded hover:bg-white/20 transition-colors"
          aria-label="Sluiten"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
