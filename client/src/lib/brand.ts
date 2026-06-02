import { resolveBrand, getDefaultBrand, type BrandConfig } from "@shared/brands";

/**
 * Bepaal het actieve merk op basis van de hostname in de browser. Dit gebeurt
 * volledig client-side (geen netwerk-call nodig), zodat branding direct
 * beschikbaar is bij het laden van de pagina. De server gebruikt dezelfde
 * shared resolver, dus client en server zijn altijd consistent.
 */
export function getCurrentBrand(): BrandConfig {
  if (typeof window === "undefined") return getDefaultBrand();
  return resolveBrand(window.location.hostname);
}

export type { BrandConfig };
