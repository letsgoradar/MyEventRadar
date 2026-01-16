import axios from "axios";

const DUTCH_MONTHS: Record<string, number> = {
  'januari': 0, 'jan': 0,
  'februari': 1, 'feb': 1,
  'maart': 2, 'mrt': 2,
  'april': 3, 'apr': 3,
  'mei': 4,
  'juni': 5, 'jun': 5,
  'juli': 6, 'jul': 6,
  'augustus': 7, 'aug': 7,
  'september': 8, 'sep': 8, 'sept': 8,
  'oktober': 9, 'okt': 9,
  'november': 10, 'nov': 10,
  'december': 11, 'dec': 11,
};

const DUTCH_DAYS = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

interface ExtractedDate {
  date: Date;
  confidence: number;
  source: string;
}

interface ExtractedTime {
  hours: number;
  minutes: number;
  confidence: number;
  source: string;
}

interface ExtractedAddress {
  street: string;
  houseNumber: string;
  city?: string;
  postalCode?: string;
  confidence: number;
  fullAddress: string;
}

interface GeocodedAddress extends ExtractedAddress {
  latitude: number;
  longitude: number;
}

export interface ContentExtractionResult {
  dates: ExtractedDate[];
  times: ExtractedTime[];
  addresses: ExtractedAddress[];
  startDate?: Date;
  startTime?: { hours: number; minutes: number };
  endTime?: { hours: number; minutes: number };
  primaryAddress?: ExtractedAddress;
  geocodedAddress?: GeocodedAddress;
  hasStructuredDate: boolean;
  hasStructuredLocation: boolean;
  extractionQuality: 'high' | 'medium' | 'low' | 'none';
}

export class ContentExtractor {
  private static geocodeCache: Map<string, { lat: number; lon: number } | null> = new Map();

  static stripHtml(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#8211;/g, '-')
      .replace(/&#8217;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  static extractDutchDates(text: string): ExtractedDate[] {
    const results: ExtractedDate[] = [];
    const cleanText = this.stripHtml(text).toLowerCase();
    const currentYear = new Date().getFullYear();

    const patterns = [
      {
        regex: /(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|jan|feb|mrt|apr|jun|jul|aug|sep|sept|okt|nov|dec)\s+(\d{4})/gi,
        handler: (match: RegExpMatchArray) => {
          const day = parseInt(match[1]);
          const month = DUTCH_MONTHS[match[2].toLowerCase()];
          const year = parseInt(match[3]);
          return { date: new Date(year, month, day), confidence: 0.95, source: match[0] };
        }
      },
      {
        regex: /(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|jan|feb|mrt|apr|jun|jul|aug|sep|sept|okt|nov|dec)(?!\s+\d{4})/gi,
        handler: (match: RegExpMatchArray) => {
          const day = parseInt(match[1]);
          const month = DUTCH_MONTHS[match[2].toLowerCase()];
          let year = currentYear;
          const testDate = new Date(year, month, day);
          if (testDate < new Date()) {
            year = currentYear + 1;
          }
          return { date: new Date(year, month, day), confidence: 0.8, source: match[0] };
        }
      },
      {
        regex: /(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)\s+(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|jan|feb|mrt|apr|jun|jul|aug|sep|sept|okt|nov|dec)(?:\s+(\d{4}))?/gi,
        handler: (match: RegExpMatchArray) => {
          const day = parseInt(match[2]);
          const month = DUTCH_MONTHS[match[3].toLowerCase()];
          let year = match[4] ? parseInt(match[4]) : currentYear;
          const testDate = new Date(year, month, day);
          if (!match[4] && testDate < new Date()) {
            year = currentYear + 1;
          }
          return { date: new Date(year, month, day), confidence: match[4] ? 0.95 : 0.85, source: match[0] };
        }
      },
      {
        regex: /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/g,
        handler: (match: RegExpMatchArray) => {
          const first = parseInt(match[1]);
          const second = parseInt(match[2]);
          const year = parseInt(match[3]);
          const day = first > 12 ? first : second;
          const month = first > 12 ? second - 1 : first - 1;
          return { date: new Date(year, month, day), confidence: 0.7, source: match[0] };
        }
      },
    ];

    for (const pattern of patterns) {
      let match;
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      while ((match = regex.exec(cleanText)) !== null) {
        try {
          const result = pattern.handler(match);
          if (result.date && !isNaN(result.date.getTime())) {
            const isDuplicate = results.some(r => 
              r.date.getTime() === result.date.getTime()
            );
            if (!isDuplicate) {
              results.push(result);
            }
          }
        } catch (e) {}
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  static extractTimes(text: string): ExtractedTime[] {
    const results: ExtractedTime[] = [];
    const cleanText = this.stripHtml(text).toLowerCase();

    const patterns = [
      {
        regex: /(\d{1,2})[:\.](\d{2})\s*(?:uur|u(?:\b|$))?/gi,
        handler: (match: RegExpMatchArray) => {
          const hours = parseInt(match[1]);
          const minutes = parseInt(match[2]);
          if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
            return { hours, minutes, confidence: 0.9, source: match[0] };
          }
          return null;
        }
      },
      {
        regex: /(\d{1,2})\s*uur/gi,
        handler: (match: RegExpMatchArray) => {
          const hours = parseInt(match[1]);
          if (hours >= 0 && hours <= 23) {
            return { hours, minutes: 0, confidence: 0.7, source: match[0] };
          }
          return null;
        }
      },
    ];

    for (const pattern of patterns) {
      let match;
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      while ((match = regex.exec(cleanText)) !== null) {
        const result = pattern.handler(match);
        if (result) {
          const isDuplicate = results.some(r => 
            r.hours === result.hours && r.minutes === result.minutes
          );
          if (!isDuplicate) {
            results.push(result);
          }
        }
      }
    }

    return results.sort((a, b) => {
      if (a.hours !== b.hours) return a.hours - b.hours;
      return a.minutes - b.minutes;
    });
  }

  static extractTimeRange(text: string): { start?: ExtractedTime; end?: ExtractedTime } {
    const cleanText = this.stripHtml(text).toLowerCase();
    
    const rangePatterns = [
      /(\d{1,2})[:\.](\d{2})\s*[-–]\s*(\d{1,2})[:\.](\d{2})\s*(?:uur|u)?/gi,
      /van\s+(\d{1,2})[:\.](\d{2})\s+tot\s+(\d{1,2})[:\.](\d{2})\s*(?:uur|u)?/gi,
      /tussen\s+(\d{1,2})[:\.](\d{2})\s+en\s+(\d{1,2})[:\.](\d{2})\s*(?:uur|u)?/gi,
    ];

    for (const pattern of rangePatterns) {
      const match = pattern.exec(cleanText);
      if (match) {
        return {
          start: { hours: parseInt(match[1]), minutes: parseInt(match[2]), confidence: 0.9, source: match[0] },
          end: { hours: parseInt(match[3]), minutes: parseInt(match[4]), confidence: 0.9, source: match[0] },
        };
      }
    }

    const times = this.extractTimes(text);
    if (times.length >= 2) {
      return { start: times[0], end: times[1] };
    } else if (times.length === 1) {
      return { start: times[0] };
    }

    return {};
  }

  static extractAddresses(text: string, municipality?: string): ExtractedAddress[] {
    const results: ExtractedAddress[] = [];
    const cleanText = this.stripHtml(text);

    const streetPatterns = [
      /([A-Z][a-zA-Zéèëïöüáàâêîôûç\-\s]{2,30}(?:straat|laan|weg|plein|singel|gracht|kade|dijk|pad|hof|steeg|park|dreef|boulevard|avenue))\s+(\d+(?:\s*[a-zA-Z])?)/gi,
      /([A-Z][a-zA-Zéèëïöüáàâêîôûç\-\s]{2,30})\s+(\d+(?:\s*[a-zA-Z])?),?\s*(?:(\d{4}\s*[A-Z]{2}))?\s*,?\s*([A-Z][a-z]+(?:\s+[a-z]+)?)?/g,
    ];

    for (const pattern of streetPatterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(cleanText)) !== null) {
        const street = match[1].trim();
        const houseNumber = match[2].trim();
        const postalCode = match[3]?.trim();
        const city = match[4]?.trim() || municipality;

        if (street.length > 3 && houseNumber) {
          const fullAddress = [street, houseNumber, postalCode, city].filter(Boolean).join(' ');
          
          const isDuplicate = results.some(r => 
            r.street.toLowerCase() === street.toLowerCase() && r.houseNumber === houseNumber
          );
          
          if (!isDuplicate) {
            results.push({
              street,
              houseNumber,
              city,
              postalCode,
              confidence: postalCode ? 0.95 : (city ? 0.8 : 0.6),
              fullAddress,
            });
          }
        }
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  static async geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
    if (this.geocodeCache.has(address)) {
      return this.geocodeCache.get(address) || null;
    }

    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: address,
          format: 'json',
          countrycodes: 'nl',
          limit: 1,
        },
        headers: {
          'User-Agent': 'letsgo-radar/1.0 (+https://letsgo-radar.nl)',
        },
        timeout: 5000,
      });

      if (response.data && response.data.length > 0) {
        const result = {
          lat: parseFloat(response.data[0].lat),
          lon: parseFloat(response.data[0].lon),
        };
        this.geocodeCache.set(address, result);
        return result;
      }

      this.geocodeCache.set(address, null);
      return null;
    } catch (error) {
      console.log(`[ContentExtractor] Geocoding failed for "${address}"`);
      return null;
    }
  }

  static async extractFromContent(
    title: string,
    content: string,
    hasStructuredDate: boolean = false,
    hasStructuredLocation: boolean = false,
    municipality?: string
  ): Promise<ContentExtractionResult> {
    const combinedText = `${title} ${content}`;
    
    const dates = this.extractDutchDates(combinedText);
    const timeRange = this.extractTimeRange(combinedText);
    const times = this.extractTimes(combinedText);
    const addresses = this.extractAddresses(content, municipality);

    let geocodedAddress: GeocodedAddress | undefined;
    if (addresses.length > 0 && !hasStructuredLocation) {
      const primaryAddress = addresses[0];
      const searchAddress = primaryAddress.city 
        ? `${primaryAddress.street} ${primaryAddress.houseNumber}, ${primaryAddress.city}, Nederland`
        : `${primaryAddress.street} ${primaryAddress.houseNumber}, ${municipality || ''}, Nederland`;
      
      const coords = await this.geocodeAddress(searchAddress);
      if (coords) {
        geocodedAddress = {
          ...primaryAddress,
          latitude: coords.lat,
          longitude: coords.lon,
        };
      }
    }

    let extractionQuality: 'high' | 'medium' | 'low' | 'none' = 'none';
    const hasDate = hasStructuredDate || dates.length > 0;
    const hasLocation = hasStructuredLocation || geocodedAddress !== undefined;

    if (hasDate && hasLocation) {
      extractionQuality = 'high';
    } else if (hasDate || hasLocation) {
      extractionQuality = 'medium';
    } else if (dates.length > 0 || addresses.length > 0) {
      extractionQuality = 'low';
    }

    return {
      dates,
      times,
      addresses,
      startDate: dates[0]?.date,
      startTime: timeRange.start,
      endTime: timeRange.end,
      primaryAddress: addresses[0],
      geocodedAddress,
      hasStructuredDate,
      hasStructuredLocation,
      extractionQuality,
    };
  }

  static analyzeContentQuality(samplePosts: any[]): {
    hasStructuredDates: boolean;
    hasStructuredLocations: boolean;
    canExtractDates: boolean;
    canExtractLocations: boolean;
    estimatedCompletePercentage: number;
    warnings: string[];
    recommendations: string[];
  } {
    let structuredDateCount = 0;
    let structuredLocationCount = 0;
    let extractableDateCount = 0;
    let extractableLocationCount = 0;
    const warnings: string[] = [];
    const recommendations: string[] = [];

    for (const post of samplePosts) {
      const hasAcfDate = post.acf?.startdatum || post.acf?.datum || post.meta?.start_date;
      const hasAcfLocation = post.acf?.latitude || post.acf?.locatie || post.acf?.adres;

      if (hasAcfDate) structuredDateCount++;
      if (hasAcfLocation) structuredLocationCount++;

      const title = post.title?.rendered || post.title || '';
      const content = post.excerpt?.rendered || post.content?.rendered || '';
      const combinedText = `${title} ${content}`;

      const dates = this.extractDutchDates(combinedText);
      const addresses = this.extractAddresses(combinedText);

      if (dates.length > 0) extractableDateCount++;
      if (addresses.length > 0) extractableLocationCount++;
    }

    const total = samplePosts.length;
    const hasStructuredDates = structuredDateCount > total * 0.5;
    const hasStructuredLocations = structuredLocationCount > total * 0.5;
    const canExtractDates = extractableDateCount > total * 0.3;
    const canExtractLocations = extractableLocationCount > total * 0.2;

    let estimatedCompletePercentage = 0;
    if (hasStructuredDates && hasStructuredLocations) {
      estimatedCompletePercentage = 80;
    } else if (hasStructuredDates || hasStructuredLocations) {
      estimatedCompletePercentage = 50;
    } else if (canExtractDates && canExtractLocations) {
      estimatedCompletePercentage = 40;
    } else if (canExtractDates || canExtractLocations) {
      estimatedCompletePercentage = 20;
    }

    if (!hasStructuredDates && !canExtractDates) {
      warnings.push('Geen datums gevonden in structured fields of content');
    }
    if (!hasStructuredLocations && !canExtractLocations) {
      warnings.push('Geen locaties gevonden in structured fields of content');
    }

    if (!hasStructuredDates && canExtractDates) {
      recommendations.push('Datums worden uit content gehaald (minder betrouwbaar)');
    }
    if (!hasStructuredLocations && canExtractLocations) {
      recommendations.push('Adressen worden uit content gehaald en gegeocodeerd');
    }

    return {
      hasStructuredDates,
      hasStructuredLocations,
      canExtractDates,
      canExtractLocations,
      estimatedCompletePercentage,
      warnings,
      recommendations,
    };
  }
}
