import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { initGA, trackPageView } from "@/lib/analytics";

export function useAnalytics() {
  const [location] = useLocation();
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initGA();
      initialized.current = true;
    }
  }, []);

  useEffect(() => {
    trackPageView(location);
  }, [location]);
}
