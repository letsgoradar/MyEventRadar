import OpenAI from "openai";
import { VenueService } from "./venue-service";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ExtractedLocation {
  venueName?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  municipality?: string;
  confidence: number;
}

export interface LocationExtractionResult {
  success: boolean;
  location?: ExtractedLocation;
  reasoning?: string;
  error?: string;
}

export class AiLocationExtractor {
  private static readonly AI_MODEL = "gpt-4o-mini";

  static async extractLocationFromText(
    text: string,
    context?: {
      title?: string;
      municipality?: string;
      sourceUrl?: string;
    }
  ): Promise<LocationExtractionResult> {
    if (!text || text.trim().length < 10) {
      return {
        success: false,
        error: "Geen tekst om te analyseren",
      };
    }

    try {
      const prompt = `Analyseer deze Nederlandse evenement-tekst en extraheer de locatie-informatie.

${context?.title ? `Evenement titel: ${context.title}` : ''}
${context?.municipality ? `Verwachte gemeente: ${context.municipality}` : ''}

Tekst:
${text.substring(0, 2000)}

Zoek naar:
1. Venue/locatie naam (bijv. "De Lindenberg", "Stadsschouwburg", "Café De Kroeg")
2. Straatnaam en huisnummer (bijv. "Kerkstraat 12", "Markt 1")
3. Postcode (bijv. "5000 AA")
4. Stad/plaats naam

Let op typische Nederlandse patronen:
- "in De Lindenberg" of "bij Café ..."
- "Locatie: ..." of "Waar: ..."
- Adressen zoals "Straatnaam 123, 1234 AB Plaatsnaam"

Antwoord alleen in JSON:
{
  "success": true/false,
  "venueName": "naam van de locatie/venue" of null,
  "address": "straat + huisnummer" of null,
  "postalCode": "1234 AB" of null,
  "city": "plaatsnaam" of null,
  "confidence": 0-100,
  "reasoning": "korte uitleg"
}`;

      const response = await openai.chat.completions.create({
        model: this.AI_MODEL,
        messages: [
          {
            role: "system",
            content: "Je bent een expert in het herkennen van locatie-informatie uit Nederlandse teksten. Focus op venue namen, straatnamen, postcodes en plaatsnamen. Wees conservatief: retourneer alleen informatie waar je zeker van bent.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 300,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return {
          success: false,
          error: "Geen response van AI",
        };
      }

      const parsed = JSON.parse(content);
      
      if (!parsed.success || (!parsed.venueName && !parsed.address && !parsed.city)) {
        return {
          success: false,
          reasoning: parsed.reasoning,
          error: "Geen locatie informatie gevonden",
        };
      }

      return {
        success: true,
        location: {
          venueName: parsed.venueName || undefined,
          address: parsed.address || undefined,
          postalCode: parsed.postalCode || undefined,
          city: parsed.city || undefined,
          municipality: context?.municipality,
          confidence: parsed.confidence || 50,
        },
        reasoning: parsed.reasoning,
      };
    } catch (error: any) {
      console.error('[AI Location Extractor] Error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  static async resolveLocationWithVenueCache(
    extractedLocation: ExtractedLocation,
    geocodeFunction: (address: string) => Promise<{ lat: number; lon: number } | null>
  ): Promise<{ latitude: number; longitude: number } | null> {
    if (extractedLocation.venueName) {
      const venueCoords = await VenueService.getVenueCoordinates(
        extractedLocation.venueName,
        extractedLocation.municipality
      );
      
      if (venueCoords) {
        console.log(`[AI Location] Found venue in cache: ${extractedLocation.venueName}`);
        return venueCoords;
      }
    }

    const addressParts: string[] = [];
    if (extractedLocation.address) addressParts.push(extractedLocation.address);
    if (extractedLocation.postalCode) addressParts.push(extractedLocation.postalCode);
    if (extractedLocation.city) addressParts.push(extractedLocation.city);
    else if (extractedLocation.municipality) addressParts.push(extractedLocation.municipality);
    addressParts.push("Nederland");

    if (addressParts.length < 2) {
      return null;
    }

    const fullAddress = addressParts.join(", ");
    console.log(`[AI Location] Geocoding address: ${fullAddress}`);
    
    const coords = await geocodeFunction(fullAddress);
    
    if (coords && extractedLocation.venueName) {
      await VenueService.findOrCreateVenue(extractedLocation.venueName, {
        municipality: extractedLocation.municipality,
        address: extractedLocation.address,
        postalCode: extractedLocation.postalCode,
        city: extractedLocation.city,
        latitude: coords.lat,
        longitude: coords.lon,
      });
      console.log(`[AI Location] Saved venue to cache: ${extractedLocation.venueName}`);
    }

    return coords ? { latitude: coords.lat, longitude: coords.lon } : null;
  }

  static async extractAndResolveLocation(
    text: string,
    context: {
      title?: string;
      municipality?: string;
      sourceUrl?: string;
    },
    geocodeFunction: (address: string) => Promise<{ lat: number; lon: number } | null>
  ): Promise<{ latitude: number; longitude: number; venueName?: string } | null> {
    const extractResult = await this.extractLocationFromText(text, context);
    
    if (!extractResult.success || !extractResult.location) {
      return null;
    }

    const coords = await this.resolveLocationWithVenueCache(
      extractResult.location,
      geocodeFunction
    );

    if (coords) {
      return {
        ...coords,
        venueName: extractResult.location.venueName,
      };
    }

    return null;
  }
}
