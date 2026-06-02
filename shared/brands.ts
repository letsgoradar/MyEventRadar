import {
  CITY_INTRO_VARIANTS,
  CITY_DESCRIPTION_VARIANTS,
  CITY_CTA_VARIANTS,
  getConsistentVariant,
  renderTemplate,
  type ContentVariant,
} from "./content";

/**
 * Centrale merk-configuratie voor het multi-merk / multi-domein systeem.
 *
 * Eén project bedient meerdere merken die worden gekozen op basis van de
 * hostname waarmee de bezoeker binnenkomt. Een "overkoepelend" merk
 * (categories === null) toont alle events; een "focus" merk toont alleen
 * events binnen de opgegeven categorieën.
 *
 * Nieuw merk toevoegen = één entry in BRANDS hieronder. Geen verdere
 * code-aanpassingen nodig.
 */
export interface BrandConfig {
  /** Stabiele identifier (gebruikt in queries / logs). */
  id: string;
  /** Merk-naam zoals getoond in de UI, bv. "Marktenradar". */
  name: string;
  /** Volledige naam incl. extensie voor titels, bv. "Marktenradar.nl". */
  displayName: string;
  /** Hostnames die naar dit merk wijzen (alleen voor focus-merken nodig). */
  hostnames: string[];
  /** Pad naar het icoon-logo, of null voor een tekst-wordmark fallback. */
  logo: string | null;
  /** Pad naar het logo-met-tekst, of null voor een tekst-wordmark fallback. */
  logoWithText: string | null;
  /** Primaire merk-kleur (hex). */
  themeColor: string;
  /**
   * Event-categorieën die dit merk toont. null = overkoepelend (alle events).
   * Een niet-lege array = focus-merk (alleen deze categorieën).
   */
  categories: string[] | null;
  /** Is dit een focus-merk (gefilterd) of het overkoepelende merk? */
  isFocus: boolean;
  /** Korte pay-off / tagline. */
  tagline: string;
  /** SEO-teksten en sjablonen per merk (vermijdt duplicate content). */
  seo: {
    homeTitle: string;
    homeDescription: string;
    /** Sjabloon voor stad-paginatitels, ondersteunt {city}. */
    cityTitleTemplate: string;
    /** Meervoud voor events, bv. "markten" / "evenementen". */
    eventNoun: string;
    /** Enkelvoud, bv. "markt" / "evenement". */
    eventNounSingular: string;
  };
}

const DEFAULT_BRAND: BrandConfig = {
  id: "letsgo",
  name: "MyEventRadar",
  displayName: "MyEventRadar.com",
  hostnames: [],
  logo: "/images/letsgo-radar-logo.png",
  logoWithText: "/images/myeventradar-logo.jpg",
  themeColor: "#00A9C5",
  categories: null,
  isFocus: false,
  tagline: "Ontdek lokale evenementen in jouw buurt",
  seo: {
    homeTitle: "MyEventRadar.com - Ontdek lokale evenementen",
    homeDescription:
      "Ontdek lokale evenementen in jouw buurt met MyEventRadar. Vind activiteiten, festivals, workshops, markten en meer.",
    cityTitleTemplate: "Evenementen in {city} - MyEventRadar.com",
    eventNoun: "evenementen",
    eventNounSingular: "evenement",
  },
};

const MARKTEN_BRAND: BrandConfig = {
  id: "markten",
  name: "Marktenradar",
  displayName: "Marktenradar.nl",
  hostnames: ["marktenradar.nl", "www.marktenradar.nl"],
  logo: null,
  logoWithText: null,
  themeColor: "#EA580C",
  categories: ["Markt & Beurs"],
  isFocus: true,
  tagline: "Alle markten en braderieën bij jou in de buurt",
  seo: {
    homeTitle: "Marktenradar.nl - Vind alle markten bij jou in de buurt",
    homeDescription:
      "Ontdek vlooienmarkten, rommelmarkten, braderieën, boerenmarkten en weekmarkten bij jou in de buurt. Marktenradar toont alle markten in Nederland op de kaart.",
    cityTitleTemplate: "Markten in {city} - Marktenradar.nl",
    eventNoun: "markten",
    eventNounSingular: "markt",
  },
};

/**
 * Alle merken. Het eerste merk is altijd het overkoepelende standaard-merk.
 * Voeg nieuwe focus-merken toe door een entry met isFocus: true en hostnames.
 */
export const BRANDS: BrandConfig[] = [DEFAULT_BRAND, MARKTEN_BRAND];

export function getDefaultBrand(): BrandConfig {
  return DEFAULT_BRAND;
}

/**
 * Bepaal het actieve merk op basis van een hostname. Onbekende of lege
 * hostnames (localhost, *.replit.dev, *.replit.app, het overkoepelende
 * domein) vallen veilig terug op het standaard-merk.
 */
export function resolveBrand(rawHost: string | undefined | null): BrandConfig {
  if (!rawHost) return DEFAULT_BRAND;
  const host = rawHost.split(":")[0].trim().toLowerCase();
  if (!host) return DEFAULT_BRAND;

  for (const brand of BRANDS) {
    if (!brand.isFocus) continue;
    if (brand.hostnames.some((h) => host === h || host.endsWith(`.${h}`))) {
      return brand;
    }
  }
  return DEFAULT_BRAND;
}

/** Bouw een document-/paginatitel voor een stad volgens het merk-sjabloon. */
export function getBrandCityTitle(brand: BrandConfig, cityName: string): string {
  return renderTemplate(brand.seo.cityTitleTemplate, { city: cityName });
}

// --- Merk-specifieke stad-content (unieke teksten per focus-merk) ---

const MARKET_INTRO_VARIANTS: ContentVariant[] = [
  {
    id: "markt-intro-1",
    type: "intro",
    template:
      "Op zoek naar een gezellige markt in {city}? Ontdek alle vlooienmarkten, rommelmarkten en braderieën in en rond {city} op de kaart.",
  },
  {
    id: "markt-intro-2",
    type: "intro",
    template:
      "Snuffelen op de markt in {city}! Van weekmarkt en boerenmarkt tot vlooienmarkt en kofferbakverkoop - vind elke markt bij jou in de buurt.",
  },
  {
    id: "markt-intro-3",
    type: "intro",
    template:
      "Markten in {city} en omgeving. Bekijk waar en wanneer de volgende braderie, rommelmarkt of streekmarkt plaatsvindt.",
  },
  {
    id: "markt-intro-4",
    type: "intro",
    template:
      "Dé marktenkalender van {city}. Mis geen enkele vlooienmarkt, antiekmarkt of boerenmarkt meer en plan je marktbezoek vooruit.",
  },
];

const MARKET_DESCRIPTION_VARIANTS: ContentVariant[] = [
  {
    id: "markt-desc-1",
    type: "description",
    template:
      "{city} kent een levendige markttraditie. Of je nu houdt van struinen over een vlooienmarkt, vers inkopen op de boerenmarkt of een dagje uit op de braderie - in {province} is er elke week wel een markt te vinden. Marktenradar verzamelt ze allemaal op één kaart.",
  },
  {
    id: "markt-desc-2",
    type: "description",
    template:
      "Markten zijn het kloppend hart van {city}. Van de wekelijkse warenmarkt tot seizoensgebonden rommelmarkten en kerstmarkten: ontdek hier alle markten in {city} en de rest van {province}, overzichtelijk op de kaart en altijd actueel.",
  },
  {
    id: "markt-desc-3",
    type: "description",
    template:
      "Houd je van markten? Dan ben je in {city} aan het juiste adres. Marktenradar toont alle markten in de regio - vlooienmarkt, antiekmarkt, streekmarkt en braderie - zodat je nooit meer een gezellige marktdag misloopt.",
  },
];

const MARKET_CTA_VARIANTS: ContentVariant[] = [
  {
    id: "markt-cta-1",
    type: "cta",
    template:
      "Wil je geen enkele markt in {city} missen? Meld je aan en ontvang de nieuwste markten in je inbox!",
  },
  {
    id: "markt-cta-2",
    type: "cta",
    template:
      "Blijf op de hoogte van alle markten in {city}. Schrijf je in en ontvang wekelijks de leukste markttips!",
  },
];

/**
 * Genereer merk-specifieke, unieke stad-content. Voor het overkoepelende
 * merk worden de generieke evenement-teksten gebruikt; focus-merken krijgen
 * eigen, niche-gerichte teksten om duplicate content te vermijden.
 */
export function getBrandCityContent(
  brand: BrandConfig,
  citySlug: string,
  cityName: string,
  provinceName: string,
): { intro: string; description: string; cta: string } {
  const variables = { city: cityName, province: provinceName };

  const introVariants =
    brand.id === "markten" ? MARKET_INTRO_VARIANTS : CITY_INTRO_VARIANTS;
  const descVariants =
    brand.id === "markten"
      ? MARKET_DESCRIPTION_VARIANTS
      : CITY_DESCRIPTION_VARIANTS;
  const ctaVariants =
    brand.id === "markten" ? MARKET_CTA_VARIANTS : CITY_CTA_VARIANTS;

  return {
    intro: renderTemplate(
      getConsistentVariant(introVariants, `${brand.id}-${citySlug}-intro`)
        .template,
      variables,
    ),
    description: renderTemplate(
      getConsistentVariant(descVariants, `${brand.id}-${citySlug}-desc`)
        .template,
      variables,
    ),
    cta: renderTemplate(
      getConsistentVariant(ctaVariants, `${brand.id}-${citySlug}-cta`).template,
      variables,
    ),
  };
}
