import * as React from "react";
import { Share, Plus, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = React.useState(false);
  const [installing, setInstalling] = React.useState(false);

  React.useEffect(() => {
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
      }
    } catch {
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#5AB2A4] text-white px-6">
      <div className="flex flex-col items-center max-w-sm w-full">
        <img
          src="/images/letsgo-radar-icon-192.png"
          alt="let's go Radar"
          className="w-24 h-24 rounded-2xl shadow-lg mb-6"
        />

        <h1 className="text-2xl font-bold mb-2 text-center">let's go Radar</h1>
        <p className="text-white/80 text-center mb-8 text-sm">
          Ontdek lokale evenementen in jouw buurt
        </p>

        {isIOS ? (
          <div className="w-full space-y-4">
            <p className="text-center text-sm font-medium mb-4">
              Installeer de app in 2 stappen:
            </p>

            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
                1
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span>Tik op</span>
                <span className="inline-flex items-center justify-center w-8 h-8 bg-white/25 rounded-lg">
                  <Share className="w-4 h-4" />
                </span>
                <span>onderaan je scherm</span>
              </div>
            </div>

            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
                2
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span>Kies</span>
                <span className="inline-flex items-center justify-center w-8 h-8 bg-white/25 rounded-lg">
                  <Plus className="w-4 h-4" />
                </span>
                <span className="font-medium">"Zet op beginscherm"</span>
              </div>
            </div>
          </div>
        ) : deferredPrompt ? (
          <button
            onClick={handleInstallClick}
            disabled={installing}
            className="w-full py-4 px-6 bg-white text-[#5AB2A4] font-bold rounded-xl text-lg shadow-lg active:scale-95 transition-transform disabled:opacity-70 flex items-center justify-center gap-3"
          >
            <Download className="w-5 h-5" />
            {installing ? "Installeren..." : "Installeer App"}
          </button>
        ) : (
          <div className="w-full space-y-4">
            <p className="text-center text-sm font-medium mb-4">
              Installeer de app via je browser:
            </p>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
                1
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span>Tik op het menu</span>
                <span className="inline-flex items-center justify-center w-6 h-6 bg-white/25 rounded text-xs font-bold">⋮</span>
                <span>rechtsboven</span>
              </div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
                2
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span>Kies</span>
                <span className="font-medium">"App installeren"</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-white/20 w-full">
          <p className="text-center text-white/50 text-xs">
            Gebruik de app op je telefoon voor de beste ervaring
          </p>
        </div>
      </div>
    </div>
  );
}
