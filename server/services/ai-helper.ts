import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface TitleSuggestion {
  title: string;
  confidence: number;
}

interface LocationInference {
  venueName: string;
  address: string;
  city: string;
  latitude?: number;
  longitude?: number;
  confidence: number;
}

const titleCache = new Map<string, TitleSuggestion>();
const locationCache = new Map<string, LocationInference>();
const translationCache = new Map<string, { title: string; description: string }>();

let lastApiCall = 0;
const MIN_DELAY_MS = 25000;

const EN_NL_DICTIONARY: Record<string, string> = {
  "christmas": "kerst",
  "christmas market": "kerstmarkt",
  "market": "markt",
  "brunch": "brunch",
  "concert": "concert",
  "workshop": "workshop",
  "festival": "festival",
  "street": "straat",
  "square": "plein",
  "park": "park",
  "museum": "museum",
  "theater": "theater",
  "theatre": "theater",
  "gallery": "galerie",
  "live": "live",
  "music": "muziek",
  "live music": "live muziek",
  "kids": "kinderen",
  "children": "kinderen",
  "family": "familie",
  "free": "gratis",
  "tickets": "tickets",
  "exhibition": "tentoonstelling",
  "expo": "expo",
  "fair": "beurs",
  "food": "eten",
  "drinks": "drinken",
  "art": "kunst",
  "night": "avond",
  "evening": "avond",
  "morning": "ochtend",
  "afternoon": "middag",
  "day": "dag",
  "tour": "rondleiding",
  "walk": "wandeling",
  "run": "hardloop",
  "running": "hardlopen",
  "dance": "dans",
  "dancing": "dansen",
  "party": "feest",
  "celebration": "viering",
  "open": "open",
  "outdoor": "buiten",
  "indoor": "binnen",
  "winter": "winter",
  "summer": "zomer",
  "spring": "lente",
  "autumn": "herfst",
  "fall": "herfst",
  "new year": "nieuwjaar",
  "new years": "nieuwjaars",
  "singalong": "meezingen",
  "sing along": "meezingen",
  "karaoke": "karaoke",
  "movie": "film",
  "film": "film",
  "screening": "vertoning",
  "comedy": "comedy",
  "show": "show",
  "performance": "optreden",
  "special": "speciaal",
  "edition": "editie",
  "special edition": "speciale editie",
  "weekly": "wekelijks",
  "monthly": "maandelijks",
  "daily": "dagelijks",
  "every": "elke",
  "and": "en",
  "with": "met",
  "at": "bij",
  "the": "de",
  "a": "een",
  "for": "voor",
  "in": "in",
  "on": "op",
  "to": "naar",
  "from": "van",
  "by": "door",
  "of": "van",
  "all": "alle",
  "welcome": "welkom",
  "join": "doe mee",
  "enjoy": "geniet",
  "experience": "beleef",
  "discover": "ontdek",
  "explore": "verken",
  "meet": "ontmoet",
  "learn": "leer",
  "create": "creëer",
  "make": "maak",
  "play": "speel",
  "watch": "kijk",
  "listen": "luister",
  "taste": "proef",
  "try": "probeer",
  "buy": "koop",
  "get": "krijg",
  "come": "kom",
  "bring": "breng",
  "take": "neem",
  "have": "heb",
  "is": "is",
  "are": "zijn",
  "will": "zal",
  "can": "kan",
  "your": "jouw",
  "our": "onze",
  "their": "hun",
  "this": "dit",
  "that": "dat",
  "these": "deze",
  "those": "die",
  "here": "hier",
  "there": "daar",
  "where": "waar",
  "when": "wanneer",
  "what": "wat",
  "who": "wie",
  "how": "hoe",
  "why": "waarom",
  "more": "meer",
  "info": "info",
  "information": "informatie",
  "details": "details",
  "read more": "lees meer",
  "click": "klik",
  "book": "boek",
  "reserve": "reserveer",
  "register": "registreer",
  "sign up": "aanmelden",
  "entrance": "entree",
  "admission": "toegang",
  "price": "prijs",
  "cost": "kosten",
  "duration": "duur",
  "location": "locatie",
  "venue": "locatie",
  "address": "adres",
  "time": "tijd",
  "date": "datum",
  "start": "start",
  "end": "einde",
  "begins": "begint",
  "ends": "eindigt",
  "hours": "uren",
  "minutes": "minuten",
  "about": "over",
  "local": "lokaal",
  "city": "stad",
  "center": "centrum",
  "centre": "centrum",
  "downtown": "centrum",
  "neighborhood": "buurt",
  "community": "gemeenschap",
  "people": "mensen",
  "friends": "vrienden",
  "guests": "gasten",
  "visitors": "bezoekers",
  "artists": "artiesten",
  "musicians": "muzikanten",
  "performers": "artiesten",
  "vendors": "verkopers",
  "stalls": "kraampjes",
  "stands": "stands",
  "activities": "activiteiten",
  "games": "spelletjes",
  "fun": "plezier",
  "entertainment": "entertainment",
  "food and drinks": "eten en drinken",
  "snacks": "snacks",
  "bar": "bar",
  "cafe": "café",
  "restaurant": "restaurant",
  "unique": "uniek",
  "beautiful": "mooi",
  "amazing": "geweldig",
  "great": "geweldig",
  "fantastic": "fantastisch",
  "wonderful": "prachtig",
  "best": "beste",
  "new": "nieuw",
  "old": "oud",
  "classic": "klassiek",
  "modern": "modern",
  "traditional": "traditioneel"
};

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCall;
  if (timeSinceLastCall < MIN_DELAY_MS && lastApiCall > 0) {
    const waitTime = MIN_DELAY_MS - timeSinceLastCall;
    console.log(`[AI] Rate limit: waiting ${Math.round(waitTime/1000)}s...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  lastApiCall = Date.now();
}

const BANNED_TITLES = [
  "read more",
  "lees meer",
  "meer info",
  "more info",
  "click here",
  "klik hier",
  "details",
  "event",
  "evenement"
];

function translateWithDictionary(text: string): { translated: string; replacements: number } {
  if (!text) return { translated: text, replacements: 0 };
  
  let result = text;
  let replacements = 0;
  
  const sortedEntries = Object.entries(EN_NL_DICTIONARY)
    .sort((a, b) => b[0].length - a[0].length);
  
  for (const [en, nl] of sortedEntries) {
    const regex = new RegExp(`\\b${en}\\b`, "gi");
    const matches = result.match(regex);
    if (matches) {
      replacements += matches.length;
      result = result.replace(regex, (match) => {
        if (match[0] === match[0].toUpperCase()) {
          return nl.charAt(0).toUpperCase() + nl.slice(1);
        }
        return nl;
      });
    }
  }
  
  return { translated: result, replacements };
}

function isLikelyEnglish(text: string): boolean {
  const englishWords = ["the", "and", "for", "with", "this", "that", "from", "have", "will", "your", "are", "was", "were", "been", "being", "has", "had", "having"];
  const words = text.toLowerCase().split(/\s+/);
  const englishCount = words.filter(w => englishWords.includes(w)).length;
  return englishCount >= 2 || (words.length > 3 && englishCount >= 1);
}

function isLikelyDutch(text: string): boolean {
  const dutchWords = ["de", "het", "een", "van", "voor", "met", "naar", "bij", "zijn", "hebben", "worden", "kunnen", "zullen", "moeten", "mogen", "jouw", "onze", "deze", "waar", "wanneer", "welkom", "gratis", "toegang"];
  const words = text.toLowerCase().split(/\s+/);
  const dutchCount = words.filter(w => dutchWords.includes(w)).length;
  return dutchCount >= 2;
}

export class AIHelper {
  static isBadTitle(title: string): boolean {
    if (!title || title.length < 5) return true;
    const lower = title.toLowerCase().trim();
    return BANNED_TITLES.some(banned => lower === banned || lower.includes(banned));
  }

  static async suggestTitle(
    description: string,
    venue?: string,
    category?: string
  ): Promise<TitleSuggestion | null> {
    if (!process.env.OPENAI_API_KEY) {
      console.log("[AI] No OpenAI API key available for title suggestion");
      return null;
    }

    const cacheKey = `title:${description.substring(0, 100)}`;
    if (titleCache.has(cacheKey)) {
      return titleCache.get(cacheKey)!;
    }

    try {
      await waitForRateLimit();
      
      const prompt = `Je bent een expert in het schrijven van pakkende, korte Nederlandse evenementtitels.

Gegeven de volgende informatie over een evenement:
- Beschrijving: ${description.substring(0, 500)}
${venue ? `- Locatie: ${venue}` : ""}
${category ? `- Categorie: ${category}` : ""}

Genereer een korte, pakkende Nederlandse titel (maximaal 50 karakters).
De titel moet:
- Direct duidelijk maken wat voor evenement het is
- Aantrekkelijk en uitnodigend zijn
- Geen prijsinformatie bevatten
- Geen datums bevatten

Antwoord alleen met de titel, zonder aanhalingstekens of extra tekst.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 60
      });

      const suggestedTitle = response.choices[0]?.message?.content?.trim();
      
      if (suggestedTitle && suggestedTitle.length > 3 && suggestedTitle.length <= 60) {
        const result: TitleSuggestion = {
          title: suggestedTitle,
          confidence: 0.9
        };
        titleCache.set(cacheKey, result);
        console.log(`[AI] Generated title: "${suggestedTitle}"`);
        return result;
      }
    } catch (error: any) {
      console.error("[AI] Error generating title:", error.message);
    }

    return null;
  }

  static async inferLocation(
    title: string,
    description: string,
    venueName?: string,
    city: string = "Eindhoven"
  ): Promise<LocationInference | null> {
    if (!process.env.OPENAI_API_KEY) {
      console.log("[AI] No OpenAI API key available for location inference");
      return null;
    }

    const cacheKey = `loc:${title.substring(0, 50)}:${description.substring(0, 100)}`;
    if (locationCache.has(cacheKey)) {
      return locationCache.get(cacheKey)!;
    }

    try {
      await waitForRateLimit();
      
      const prompt = `Je bent een expert in het bepalen van exacte locaties van evenementen in Nederland.

Gegeven de volgende informatie over een evenement:
- Titel: ${title}
- Beschrijving: ${description.substring(0, 800)}
${venueName ? `- Genoemde locatie: ${venueName}` : ""}
- Stad: ${city}

Bepaal de meest waarschijnlijke exacte locatie waar dit evenement plaatsvindt.

Denk na over:
- Bekende venues in ${city} die passen bij dit type evenement
- Locatienamen genoemd in de tekst
- Het type evenement en waar dat typisch plaatsvindt

Antwoord in exact dit JSON formaat (geen markdown, alleen JSON):
{
  "venueName": "Naam van de venue/locatie",
  "address": "Volledig straatnaam met huisnummer",
  "city": "${city}",
  "confidence": 0.8
}

Gebruik alleen echte, bestaande locaties in ${city}. Als je niet zeker bent, geef dan een logische locatie met een lagere confidence score (0.3-0.5).`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 200
      });

      const content = response.choices[0]?.message?.content?.trim();
      
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as LocationInference;
          
          if (parsed.venueName && parsed.address && parsed.confidence > 0) {
            locationCache.set(cacheKey, parsed);
            console.log(`[AI] Inferred location: "${parsed.venueName}" at "${parsed.address}" (confidence: ${parsed.confidence})`);
            return parsed;
          }
        }
      }
    } catch (error: any) {
      console.error("[AI] Error inferring location:", error.message);
    }

    return null;
  }

  static clearCache(): void {
    titleCache.clear();
    locationCache.clear();
    console.log("[AI] Cache cleared");
  }

  static async translateToNL(
    englishText: string,
    type: "title" | "description"
  ): Promise<string | null> {
    if (!process.env.OPENAI_API_KEY) {
      return null;
    }

    if (!englishText || englishText.length < 3) return null;

    const cacheKey = `translate:${type}:${englishText.substring(0, 50)}`;
    const cached = titleCache.get(cacheKey);
    if (cached) {
      return cached.title;
    }

    try {
      await waitForRateLimit();
      
      const prompt = type === "title"
        ? `Vertaal de volgende Engelse evenementtitel naar een korte, pakkende Nederlandse titel (max 50 karakters). Behoud de essentie en maak het aantrekkelijk.

Engelse titel: "${englishText}"

Antwoord alleen met de Nederlandse titel, zonder aanhalingstekens.`
        : `Vertaal de volgende Engelse evenementbeschrijving naar vloeiend Nederlands. Behoud de informatie en stijl.

Engels:
${englishText.substring(0, 1000)}

Antwoord alleen met de Nederlandse vertaling.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: type === "title" ? 60 : 500
      });

      const translated = response.choices[0]?.message?.content?.trim();
      
      if (translated && translated.length > 2) {
        titleCache.set(cacheKey, { title: translated, confidence: 1 });
        console.log(`[AI] Translated ${type}: "${englishText.substring(0, 30)}..." -> "${translated.substring(0, 30)}..."`);
        return translated;
      }
    } catch (error: any) {
      console.error("[AI] Error translating:", error.message);
    }

    return null;
  }

  static async translateEventToNL(
    title: string,
    description: string
  ): Promise<{ title: string; description: string } | null> {
    if (!process.env.OPENAI_API_KEY) {
      return null;
    }

    if (!title || title.length < 3) return null;

    const cacheKey = `translate:${title.substring(0, 30)}:${description.substring(0, 30)}`;
    const cached = translationCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      await waitForRateLimit();
      
      const prompt = `Vertaal het volgende Engelse evenement naar het Nederlands.

TITEL (Engels): ${title}
BESCHRIJVING (Engels): ${description.substring(0, 800)}

Geef je antwoord EXACT in dit JSON formaat (geen markdown):
{
  "title": "Nederlandse titel (max 50 karakters, pakkend)",
  "description": "Nederlandse beschrijving (vloeiend, informatief)"
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 600
      });

      const content = response.choices[0]?.message?.content?.trim();
      
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as { title: string; description: string };
          if (parsed.title && parsed.description) {
            translationCache.set(cacheKey, parsed);
            console.log(`[AI] Translated event: "${title.substring(0, 25)}..." -> "${parsed.title.substring(0, 25)}..."`);
            return parsed;
          }
        }
      }
    } catch (error: any) {
      console.error("[AI] Error translating event:", error.message);
    }

    return null;
  }

  static fastTranslateEvent(
    title: string,
    description: string
  ): { title: string; description: string; usedAI: boolean; confidence: "high" | "medium" | "low" } {
    if (isLikelyDutch(title) && isLikelyDutch(description)) {
      console.log(`[Dictionary] Already Dutch: "${title.substring(0, 30)}..."`);
      return { title, description, usedAI: false, confidence: "high" };
    }
    
    const titleResult = translateWithDictionary(title);
    const descResult = translateWithDictionary(description);
    
    const totalReplacements = titleResult.replacements + descResult.replacements;
    const titleWords = title.split(/\s+/).length;
    const descWords = description.split(/\s+/).length;
    const totalWords = titleWords + descWords;
    
    const replacementRatio = totalWords > 0 ? totalReplacements / totalWords : 0;
    
    let confidence: "high" | "medium" | "low";
    if (replacementRatio >= 0.3 || totalReplacements >= 5) {
      confidence = "high";
    } else if (replacementRatio >= 0.15 || totalReplacements >= 3) {
      confidence = "medium";
    } else {
      confidence = "low";
    }
    
    const translatedTitle = titleResult.translated;
    const translatedDesc = descResult.translated;
    
    if (isLikelyDutch(translatedTitle) || confidence === "high") {
      console.log(`[Dictionary] Translated (${confidence}): "${title.substring(0, 25)}..." -> "${translatedTitle.substring(0, 25)}..." (${totalReplacements} replacements)`);
      return { 
        title: translatedTitle, 
        description: translatedDesc, 
        usedAI: false, 
        confidence 
      };
    }
    
    console.log(`[Dictionary] Partial translation (${confidence}): "${title.substring(0, 25)}..." (${totalReplacements} replacements)`);
    return { 
      title: translatedTitle, 
      description: translatedDesc, 
      usedAI: false, 
      confidence 
    };
  }

  static async smartTranslateEvent(
    title: string,
    description: string,
    useAIFallback: boolean = false
  ): Promise<{ title: string; description: string; usedAI: boolean }> {
    const fastResult = this.fastTranslateEvent(title, description);
    
    if (fastResult.confidence === "high" || fastResult.confidence === "medium") {
      return { 
        title: fastResult.title, 
        description: fastResult.description, 
        usedAI: false 
      };
    }
    
    if (useAIFallback && process.env.OPENAI_API_KEY) {
      console.log(`[Translation] Low confidence, trying AI fallback...`);
      const aiResult = await this.translateEventToNL(title, description);
      if (aiResult) {
        return { ...aiResult, usedAI: true };
      }
    }
    
    return { 
      title: fastResult.title, 
      description: fastResult.description, 
      usedAI: false 
    };
  }
}
