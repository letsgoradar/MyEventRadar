declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

function isEnabled(): boolean {
  return !!GA_ID && typeof window !== "undefined" && typeof window.gtag === "function";
}

export function initGA() {
  if (!GA_ID) return;

  const consent = localStorage.getItem("cookie-consent");
  if (consent !== "accepted") return;

  if (document.querySelector(`script[src*="googletagmanager"]`)) return;

  window.gtag("consent", "update", {
    analytics_storage: "granted",
  });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  window.gtag("js", new Date());
  window.gtag("config", GA_ID, {
    send_page_view: false,
  });
}

export function trackPageView(path: string) {
  if (!isEnabled() || !document.querySelector(`script[src*="googletagmanager"]`)) return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.origin + path,
  });
}

export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  if (!isEnabled() || !document.querySelector(`script[src*="googletagmanager"]`)) return;
  window.gtag("event", eventName, params);
}

export function trackEventView(eventTitle: string, eventId?: number, category?: string) {
  trackEvent("event_view", {
    event_title: eventTitle,
    event_id: eventId,
    event_category: category,
  });
}

export function trackExternalClick(url: string, eventTitle?: string) {
  trackEvent("external_click", {
    link_url: url,
    event_title: eventTitle,
  });
}

export function trackSignUp(method: string = "email") {
  trackEvent("sign_up", { method });
}

export function trackAddFavorite(eventTitle: string, eventId?: number) {
  trackEvent("add_to_favorites", {
    event_title: eventTitle,
    event_id: eventId,
  });
}

export function trackSearch(searchTerm: string, filters?: Record<string, unknown>) {
  trackEvent("search", {
    search_term: searchTerm,
    ...filters,
  });
}

export function revokeConsent() {
  if (!GA_ID || typeof window === "undefined") return;
  window.gtag?.("consent", "update", {
    analytics_storage: "denied",
  });
}
