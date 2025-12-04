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
}
