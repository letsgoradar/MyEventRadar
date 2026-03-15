import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { initGA, revokeConsent } from "@/lib/analytics";
import { Cookie, X } from "lucide-react";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!visible) return null;

  function accept() {
    localStorage.setItem("cookie-consent", "accepted");
    setVisible(false);
    initGA();
  }

  function decline() {
    localStorage.setItem("cookie-consent", "declined");
    setVisible(false);
    revokeConsent();
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-3 sm:p-4 animate-in slide-in-from-bottom-4 duration-500">
      <div className="mx-auto max-w-lg bg-card border border-border rounded-xl shadow-lg p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Cookie className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground leading-relaxed">
              Wij gebruiken cookies om het gebruik van onze website te analyseren en je ervaring te verbeteren.{" "}
              <a href="/privacy" className="underline text-primary hover:text-primary/80">
                Privacybeleid
              </a>
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={accept} className="text-xs">
                Accepteren
              </Button>
              <Button size="sm" variant="outline" onClick={decline} className="text-xs">
                Weigeren
              </Button>
            </div>
          </div>
          <button
            onClick={decline}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Sluiten"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
