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
  /**
   * Optionele trefwoorden (case-insensitive substring) die in de event-titel
   * worden gezocht. Vangt relevante events op die onder een verkeerde
   * categorie zijn geïmporteerd (bv. een foodtruckfestival onder "Activiteit").
   * Alleen van toepassing op focus-merken.
   */
  matchKeywords?: string[];
  /**
   * Optionele tag-namen (case-insensitive) die worden vergeleken met de
   * vrije-tekst `tags` van een event. Vangt mislabelde events op die wel de
   * juiste tag hebben gekregen. Alleen van toepassing op focus-merken.
   */
  matchTags?: string[];
  /**
   * Optionele landfilter (ISO-landcodes, bv. ["BE"]). Undefined/leeg = alle
   * landen (huidige situatie: het overkoepelende merk toont NL én BE). Een merk
   * met countries: ["BE"] toont uitsluitend Belgische events; een toekomstige
   * Belgische URL gebruikt dit. Events zonder land worden als "NL" behandeld
   * (bestaande data van vóór de country-kolom).
   */
  countries?: string[];
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
  name: "Evenementenradar",
  displayName: "Evenementenradar.nl",
  hostnames: [],
  logo: "/images/evenementenradar-icon-navy.png",
  logoWithText: "/images/evenementenradar-logo.png",
  themeColor: "#18c7b2",
  categories: null,
  isFocus: false,
  tagline: "Ontdek lokale evenementen in jouw buurt",
  seo: {
    homeTitle: "Evenementenradar.nl - Ontdek lokale evenementen",
    homeDescription:
      "Ontdek lokale evenementen in jouw buurt met Evenementenradar.nl. Vind activiteiten, festivals, workshops, markten en meer.",
    cityTitleTemplate: "Evenementen in {city} - Evenementenradar.nl",
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
  matchKeywords: [
    "braderie",
    "rommelmarkt",
    "vlooienmarkt",
    "boerenmarkt",
    "kerstmarkt",
    "antiekmarkt",
    "snuffelmarkt",
    "jaarmarkt",
    "warenmarkt",
    "weekmarkt",
    "streekmarkt",
    "boekenmarkt",
    "vrijmarkt",
    "kofferbakverkoop",
    "kofferbakmarkt",
  ],
  matchTags: ["markt", "braderie", "rommelmarkt", "vlooienmarkt"],
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

const FOODTRUCK_BRAND: BrandConfig = {
  id: "foodtruck",
  name: "Foodtruckfestivalradar",
  displayName: "Foodtruckfestivalradar.nl",
  hostnames: ["foodtruckfestivalradar.nl", "www.foodtruckfestivalradar.nl"],
  logo: null,
  logoWithText: null,
  themeColor: "#DC2626",
  categories: ["Eten & Drinken"],
  matchKeywords: [
    "foodtruck",
    "food truck",
    "streetfood",
    "street food",
    "food festival",
    "foodfestival",
    "foodmarkt",
    "food market",
    "culinair festival",
    "smaakfestival",
    "proeverij",
  ],
  matchTags: ["foodtruck", "streetfood", "foodfestival"],
  isFocus: true,
  tagline: "Alle foodtruckfestivals en streetfood-events bij jou in de buurt",
  seo: {
    homeTitle:
      "Foodtruckfestivalradar.nl - Vind alle foodtruckfestivals bij jou in de buurt",
    homeDescription:
      "Ontdek alle foodtruckfestivals, streetfood-events en foodmarkten bij jou in de buurt. Foodtruckfestivalradar toont elk foodtruckfestival in Nederland op de kaart.",
    cityTitleTemplate:
      "Foodtruckfestivals in {city} - Foodtruckfestivalradar.nl",
    eventNoun: "foodtruckfestivals",
    eventNounSingular: "foodtruckfestival",
  },
};

/**
 * Alle merken. Het eerste merk is altijd het overkoepelende standaard-merk.
 * Voeg nieuwe focus-merken toe door een entry met isFocus: true en hostnames.
 */
export const BRANDS: BrandConfig[] = [
  DEFAULT_BRAND,
  MARKTEN_BRAND,
  FOODTRUCK_BRAND,
];

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

/**
 * Bepaal of een event bij een merk hoort. Het overkoepelende merk
 * (categories === null) accepteert alles. Een focus-merk accepteert een event
 * als de categorie matcht, OF de titel een van de merk-trefwoorden bevat, OF
 * een van de event-tags overeenkomt met de merk-tags. Zo verschijnen ook
 * mislabelde events (bv. een foodtruckfestival onder "Activiteit") op het merk.
 */
export function eventMatchesBrand(
  event: {
    category?: string | null;
    title?: string | null;
    tags?: (string | null)[] | null;
    country?: string | null;
  },
  brand: BrandConfig,
): boolean {
  // Landfilter (onafhankelijk van categorie). Events zonder land = "NL".
  if (brand.countries && brand.countries.length > 0) {
    const eventCountry = (event.country || "NL").toUpperCase();
    const allowed = brand.countries.map((c) => c.toUpperCase());
    if (!allowed.includes(eventCountry)) return false;
  }

  if (!brand.categories) return true;

  if (event.category != null && brand.categories.includes(event.category)) {
    return true;
  }

  if (brand.matchKeywords && brand.matchKeywords.length > 0 && event.title) {
    const title = event.title.toLowerCase();
    if (brand.matchKeywords.some((kw) => title.includes(kw.toLowerCase()))) {
      return true;
    }
  }

  if (brand.matchTags && brand.matchTags.length > 0 && event.tags) {
    const eventTags = new Set(
      event.tags
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.toLowerCase()),
    );
    if (brand.matchTags.some((t) => eventTags.has(t.toLowerCase()))) {
      return true;
    }
  }

  return false;
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

const FOODTRUCK_INTRO_VARIANTS: ContentVariant[] = [
  {
    id: "foodtruck-intro-1",
    type: "intro",
    template:
      "Zin in streetfood in {city}? Ontdek alle foodtruckfestivals, foodmarkten en streetfood-events in en rond {city} op de kaart.",
  },
  {
    id: "foodtruck-intro-2",
    type: "intro",
    template:
      "Smullen bij de foodtrucks in {city}! Van burgers en taco's tot verse oesters en zoete lekkernijen - vind elk foodtruckfestival bij jou in de buurt.",
  },
  {
    id: "foodtruck-intro-3",
    type: "intro",
    template:
      "Foodtruckfestivals in {city} en omgeving. Bekijk waar en wanneer het volgende streetfood-festival of foodtruck-evenement plaatsvindt.",
  },
  {
    id: "foodtruck-intro-4",
    type: "intro",
    template:
      "Dé foodtruckkalender van {city}. Mis geen enkel foodtruckfestival, streetfood-event of foodmarkt meer en plan je culinaire dagje uit.",
  },
];

const FOODTRUCK_DESCRIPTION_VARIANTS: ContentVariant[] = [
  {
    id: "foodtruck-desc-1",
    type: "description",
    template:
      "{city} is een walhalla voor liefhebbers van streetfood. Of je nu gaat voor sappige burgers, knapperige loaded fries of een exotische hap - in {province} is er regelmatig wel een foodtruckfestival te vinden. Foodtruckfestivalradar verzamelt ze allemaal op één kaart.",
  },
  {
    id: "foodtruck-desc-2",
    type: "description",
    template:
      "Foodtruckfestivals zijn niet meer weg te denken uit {city}. Van gezellige streetfood-markten tot grote foodtruck-evenementen met live muziek: ontdek hier alle foodtruckfestivals in {city} en de rest van {province}, overzichtelijk op de kaart en altijd actueel.",
  },
  {
    id: "foodtruck-desc-3",
    type: "description",
    template:
      "Houd je van lekker eten op locatie? Dan zit je in {city} goed. Foodtruckfestivalradar toont alle foodtruckfestivals in de regio - streetfood, foodmarkten en culinaire festivals - zodat je nooit meer een smakelijk evenement misloopt.",
  },
];

const FOODTRUCK_CTA_VARIANTS: ContentVariant[] = [
  {
    id: "foodtruck-cta-1",
    type: "cta",
    template:
      "Wil je geen enkel foodtruckfestival in {city} missen? Meld je aan en ontvang de nieuwste foodtruck-events in je inbox!",
  },
  {
    id: "foodtruck-cta-2",
    type: "cta",
    template:
      "Blijf op de hoogte van alle foodtruckfestivals in {city}. Schrijf je in en ontvang wekelijks de lekkerste streetfood-tips!",
  },
];

/**
 * Merk-specifieke content-pools. Een focus-merk dat hier niet voorkomt valt
 * terug op de generieke evenement-teksten (CITY_*_VARIANTS).
 */
const BRAND_CONTENT_VARIANTS: Record<
  string,
  { intro: ContentVariant[]; description: ContentVariant[]; cta: ContentVariant[] }
> = {
  markten: {
    intro: MARKET_INTRO_VARIANTS,
    description: MARKET_DESCRIPTION_VARIANTS,
    cta: MARKET_CTA_VARIANTS,
  },
  foodtruck: {
    intro: FOODTRUCK_INTRO_VARIANTS,
    description: FOODTRUCK_DESCRIPTION_VARIANTS,
    cta: FOODTRUCK_CTA_VARIANTS,
  },
};

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

  const brandVariants = BRAND_CONTENT_VARIANTS[brand.id];
  const introVariants = brandVariants?.intro ?? CITY_INTRO_VARIANTS;
  const descVariants = brandVariants?.description ?? CITY_DESCRIPTION_VARIANTS;
  const ctaVariants = brandVariants?.cta ?? CITY_CTA_VARIANTS;

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
