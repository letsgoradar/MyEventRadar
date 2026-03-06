import * as React from "react";
import { Share, Plus, Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = React.useState(false);
  const [installing, setInstalling] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    const wasDismissed = localStorage.getItem("pwa-modal-dismissed");
    if (wasDismissed) {
      const dismissedAt = parseInt(wasDismissed, 10);
      if (Date.now() - dismissedAt < 24 * 60 * 60 * 1000) {
        setDismissed(true);
      }
    }

    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(ios);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
        setDismissed(true);
      }
    } catch {
    } finally {
      setInstalling(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("pwa-modal-dismissed", Date.now().toString());
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
          aria-label="Sluiten"
        >
          <X className="w-4 h-4" />
        </button>

        <img
          src="/images/letsgo-radar-brand.jpg"
          alt="letsgo radar"
          className="rounded shadow-md mb-5 mx-auto"
          style={{ width: '260px', height: 'auto' }}
        />

        <p className="text-gray-500 text-sm mb-5">
          Voeg de app toe aan je beginscherm voor de beste ervaring
        </p>

        {isIOS ? (
          <div className="space-y-3 text-left">
            <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#5AB2A4] text-white flex items-center justify-center text-sm font-bold">
                1
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span>Tik op het</span>
                <span className="inline-flex items-center justify-center w-7 h-7 bg-[#5AB2A4]/10 rounded-lg">
                  <Share className="w-3.5 h-3.5 text-[#5AB2A4]" />
                </span>
                <span>icoon</span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#5AB2A4] text-white flex items-center justify-center text-sm font-bold">
                2
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span>Kies</span>
                <span className="inline-flex items-center justify-center w-7 h-7 bg-[#5AB2A4]/10 rounded-lg">
                  <Plus className="w-3.5 h-3.5 text-[#5AB2A4]" />
                </span>
                <span className="font-medium">"Zet op beginscherm"</span>
              </div>
            </div>
          </div>
        ) : deferredPrompt ? (
          <button
            onClick={handleInstallClick}
            disabled={installing}
            className="w-full py-3 px-5 bg-[#5AB2A4] text-white font-semibold rounded-xl text-base shadow-md active:scale-95 transition-transform disabled:opacity-70 flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            {installing ? "Installeren..." : "Installeer App"}
          </button>
        ) : (
          <div className="space-y-3 text-left">
            <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#5AB2A4] text-white flex items-center justify-center text-sm font-bold">
                1
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span>Tik op het menu</span>
                <span className="inline-flex items-center justify-center w-6 h-6 bg-[#5AB2A4]/10 rounded text-xs font-bold text-[#5AB2A4]">⋮</span>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#5AB2A4] text-white flex items-center justify-center text-sm font-bold">
                2
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span>Kies</span>
                <span className="font-medium">"App installeren"</span>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleDismiss}
          className="mt-4 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          Later
        </button>
      </div>
    </div>
  );
}
