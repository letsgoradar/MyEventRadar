import { db } from "../db";
import { feedFieldMappings, FeedFieldMapping } from "@shared/schema";
import { eq, and } from "drizzle-orm";

interface DetectedField {
  fieldPath: string;
  fieldType: 'latitude' | 'longitude' | 'location_name' | 'venue_name' | 'address' | 'city' | 'postal_code' | 'country' | 'start_date' | 'end_date' | 'start_time' | 'calendar' | 'unknown';
  confidence: number;
  sampleValue: any;
  detectionReason: string;
}

interface FieldDetectionResult {
  detectedFields: DetectedField[];
  suggestedMappings: Record<string, string>;
  hasLocationData: boolean;
  hasDateData: boolean;
  locationCompleteness: number;
  dateCompleteness: number;
}

const LATITUDE_PATTERNS = [
  /^lat$/i, /^latitude$/i, /^geo[_:]?lat$/i, /^data[_:]?lat$/i,
  /^coords?[_:]?lat$/i, /^location[_:]?lat$/i, /^y$/i, /^gps[_:]?lat$/i
];

const LONGITUDE_PATTERNS = [
  /^lng$/i, /^lon$/i, /^long$/i, /^longitude$/i, /^geo[_:]?lng$/i, /^geo[_:]?lon$/i,
  /^data[_:]?lng$/i, /^data[_:]?lon$/i, /^coords?[_:]?lng$/i, /^coords?[_:]?lon$/i,
  /^location[_:]?lng$/i, /^location[_:]?lon$/i, /^x$/i, /^gps[_:]?lng$/i
];

const VENUE_PATTERNS = [
  /^venue$/i, /^location$/i, /^locatie$/i, /^data[_:]?location$/i,
  /^venue[_:]?name$/i, /^location[_:]?name$/i, /^place$/i, /^plaats$/i
];

const ADDRESS_PATTERNS = [
  /^address$/i, /^adres$/i, /^street$/i, /^straat$/i, /^data[_:]?address$/i,
  /^street[_:]?address$/i, /^addr$/i, /^full[_:]?address$/i
];

const CITY_PATTERNS = [
  /^city$/i, /^stad$/i, /^plaats$/i, /^town$/i, /^gemeente$/i,
  /^data[_:]?city$/i, /^location[_:]?city$/i, /^woonplaats$/i
];

const POSTAL_CODE_PATTERNS = [
  /^postal[_:]?code$/i, /^postcode$/i, /^zip$/i, /^zipcode$/i,
  /^data[_:]?zipcode$/i, /^plz$/i, /^post$/i
];

const START_DATE_PATTERNS = [
  /^start[_:]?date$/i, /^startdatum$/i, /^begin[_:]?date$/i, /^datum$/i,
  /^event[_:]?date$/i, /^date$/i, /^start$/i, /^when$/i, /^wanneer$/i
];

const END_DATE_PATTERNS = [
  /^end[_:]?date$/i, /^einddatum$/i, /^eind[_:]?date$/i, /^finish[_:]?date$/i,
  /^end$/i, /^einde$/i, /^tot$/i, /^until$/i
];

const CALENDAR_PATTERNS = [
  /^calendar$/i, /^data[_:]?calendar$/i, /^datetime$/i, /^event[_:]?time$/i,
  /^schedule$/i, /^tijd$/i, /^time$/i
];

export class FeedFieldDetector {
  
  static isValidLatitude(value: any): boolean {
    const num = parseFloat(String(value));
    return !isNaN(num) && num >= -90 && num <= 90;
  }

  static isValidLongitude(value: any): boolean {
    const num = parseFloat(String(value));
    return !isNaN(num) && num >= -180 && num <= 180;
  }

  static isDutchLatitude(value: any): boolean {
    const num = parseFloat(String(value));
    return !isNaN(num) && num >= 50.5 && num <= 53.7;
  }

  static isDutchLongitude(value: any): boolean {
    const num = parseFloat(String(value));
    return !isNaN(num) && num >= 3.3 && num <= 7.3;
  }

  static isDateString(value: any): boolean {
    if (typeof value !== 'string') return false;
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}/, // ISO date
      /^\d{2}-\d{2}-\d{4}/, // DD-MM-YYYY
      /^\d{1,2}\s+(jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec)/i, // Dutch date
      /^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}/, // ISO datetime
    ];
    return datePatterns.some(p => p.test(value));
  }

  static isCalendarString(value: any): boolean {
    if (typeof value !== 'string') return false;
    return /\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}/.test(value);
  }

  static isDutchPostalCode(value: any): boolean {
    if (typeof value !== 'string') return false;
    return /^\d{4}\s*[A-Za-z]{2}$/.test(value.trim());
  }

  static extractAllFields(item: any, prefix: string = ''): Array<{ path: string; value: any }> {
    const fields: Array<{ path: string; value: any }> = [];
    
    if (item === null || item === undefined) return fields;
    
    if (typeof item === 'object' && !Array.isArray(item)) {
      for (const [key, value] of Object.entries(item)) {
        const path = prefix ? `${prefix}.${key}` : key;
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          fields.push(...this.extractAllFields(value, path));
        } else {
          fields.push({ path, value });
        }
      }
    }
    
    return fields;
  }

  static detectFieldType(fieldPath: string, value: any): DetectedField | null {
    const fieldName = fieldPath.split('.').pop() || fieldPath;
    
    // Check latitude patterns
    if (LATITUDE_PATTERNS.some(p => p.test(fieldName))) {
      if (this.isValidLatitude(value)) {
        return {
          fieldPath,
          fieldType: 'latitude',
          confidence: this.isDutchLatitude(value) ? 0.95 : 0.8,
          sampleValue: value,
          detectionReason: `Field name matches latitude pattern, value ${value} is valid coordinate`
        };
      }
    }

    // Check longitude patterns
    if (LONGITUDE_PATTERNS.some(p => p.test(fieldName))) {
      if (this.isValidLongitude(value)) {
        return {
          fieldPath,
          fieldType: 'longitude',
          confidence: this.isDutchLongitude(value) ? 0.95 : 0.8,
          sampleValue: value,
          detectionReason: `Field name matches longitude pattern, value ${value} is valid coordinate`
        };
      }
    }

    // Check venue patterns
    if (VENUE_PATTERNS.some(p => p.test(fieldName))) {
      if (typeof value === 'string' && value.length > 2 && value.length < 200) {
        return {
          fieldPath,
          fieldType: 'venue_name',
          confidence: 0.85,
          sampleValue: value,
          detectionReason: `Field name matches venue/location pattern`
        };
      }
    }

    // Check address patterns
    if (ADDRESS_PATTERNS.some(p => p.test(fieldName))) {
      if (typeof value === 'string' && value.length > 5) {
        return {
          fieldPath,
          fieldType: 'address',
          confidence: 0.85,
          sampleValue: value,
          detectionReason: `Field name matches address pattern`
        };
      }
    }

    // Check city patterns
    if (CITY_PATTERNS.some(p => p.test(fieldName))) {
      if (typeof value === 'string' && value.length > 1 && value.length < 100) {
        return {
          fieldPath,
          fieldType: 'city',
          confidence: 0.85,
          sampleValue: value,
          detectionReason: `Field name matches city pattern`
        };
      }
    }

    // Check postal code patterns
    if (POSTAL_CODE_PATTERNS.some(p => p.test(fieldName))) {
      if (this.isDutchPostalCode(value)) {
        return {
          fieldPath,
          fieldType: 'postal_code',
          confidence: 0.95,
          sampleValue: value,
          detectionReason: `Field name matches postal code pattern, value is valid Dutch postal code`
        };
      }
    }

    // Check calendar/datetime patterns
    if (CALENDAR_PATTERNS.some(p => p.test(fieldName))) {
      if (this.isCalendarString(value)) {
        return {
          fieldPath,
          fieldType: 'calendar',
          confidence: 0.9,
          sampleValue: value,
          detectionReason: `Field name matches calendar pattern, value contains date and time`
        };
      }
    }

    // Check start date patterns
    if (START_DATE_PATTERNS.some(p => p.test(fieldName))) {
      if (this.isDateString(value)) {
        return {
          fieldPath,
          fieldType: 'start_date',
          confidence: 0.85,
          sampleValue: value,
          detectionReason: `Field name matches start date pattern`
        };
      }
    }

    // Check end date patterns
    if (END_DATE_PATTERNS.some(p => p.test(fieldName))) {
      if (this.isDateString(value)) {
        return {
          fieldPath,
          fieldType: 'end_date',
          confidence: 0.85,
          sampleValue: value,
          detectionReason: `Field name matches end date pattern`
        };
      }
    }

    // Value-based detection (when field name doesn't match but value does)
    if (typeof value === 'number' || (typeof value === 'string' && /^-?\d+\.?\d*$/.test(value))) {
      const num = parseFloat(String(value));
      if (this.isDutchLatitude(num) && fieldName.toLowerCase().includes('lat')) {
        return {
          fieldPath,
          fieldType: 'latitude',
          confidence: 0.7,
          sampleValue: value,
          detectionReason: `Value ${value} looks like Dutch latitude`
        };
      }
      if (this.isDutchLongitude(num) && fieldName.toLowerCase().includes('lng')) {
        return {
          fieldPath,
          fieldType: 'longitude',
          confidence: 0.7,
          sampleValue: value,
          detectionReason: `Value ${value} looks like Dutch longitude`
        };
      }
    }

    if (this.isDutchPostalCode(value)) {
      return {
        fieldPath,
        fieldType: 'postal_code',
        confidence: 0.7,
        sampleValue: value,
        detectionReason: `Value ${value} is a valid Dutch postal code`
      };
    }

    return null;
  }

  static analyzeItems(items: any[]): FieldDetectionResult {
    const fieldCounts: Map<string, Map<string, number>> = new Map();
    const fieldSamples: Map<string, any> = new Map();
    const allDetected: DetectedField[] = [];

    // Analyze each item
    for (const item of items.slice(0, 10)) { // Sample first 10 items
      const rawData = item.rawData || item;
      const fields = this.extractAllFields(rawData);

      for (const { path, value } of fields) {
        const detection = this.detectFieldType(path, value);
        if (detection) {
          if (!fieldCounts.has(path)) {
            fieldCounts.set(path, new Map());
            fieldSamples.set(path, value);
          }
          const typeCount = fieldCounts.get(path)!;
          typeCount.set(detection.fieldType, (typeCount.get(detection.fieldType) || 0) + 1);
        }
      }
    }

    // Consolidate detections
    const suggestedMappings: Record<string, string> = {};
    
    for (const [path, typeCounts] of Array.from(fieldCounts.entries())) {
      let bestType = 'unknown';
      let bestCount = 0;
      
      for (const [type, count] of Array.from(typeCounts.entries())) {
        if (count > bestCount) {
          bestCount = count;
          bestType = type;
        }
      }

      if (bestType !== 'unknown') {
        const confidence = bestCount / Math.min(items.length, 10);
        allDetected.push({
          fieldPath: path,
          fieldType: bestType as any,
          confidence,
          sampleValue: fieldSamples.get(path),
          detectionReason: `Detected in ${bestCount} of ${Math.min(items.length, 10)} items`
        });
        suggestedMappings[bestType] = path;
      }
    }

    // Sort by confidence
    allDetected.sort((a, b) => b.confidence - a.confidence);

    // Calculate completeness
    const hasLat = allDetected.some(d => d.fieldType === 'latitude');
    const hasLng = allDetected.some(d => d.fieldType === 'longitude');
    const hasVenue = allDetected.some(d => d.fieldType === 'venue_name');
    const hasAddress = allDetected.some(d => d.fieldType === 'address');
    const hasCity = allDetected.some(d => d.fieldType === 'city');
    const hasDate = allDetected.some(d => ['start_date', 'calendar'].includes(d.fieldType));

    let locationCompleteness = 0;
    if (hasLat && hasLng) locationCompleteness += 50;
    if (hasVenue) locationCompleteness += 20;
    if (hasAddress) locationCompleteness += 20;
    if (hasCity) locationCompleteness += 10;

    let dateCompleteness = hasDate ? 100 : 0;

    return {
      detectedFields: allDetected,
      suggestedMappings,
      hasLocationData: hasLat || hasVenue || hasAddress,
      hasDateData: hasDate,
      locationCompleteness: Math.min(100, locationCompleteness),
      dateCompleteness
    };
  }

  static async saveMapping(domain: string, mappings: Record<string, string>): Promise<void> {
    const existing = await db.select()
      .from(feedFieldMappings)
      .where(eq(feedFieldMappings.domain, domain))
      .limit(1);

    if (existing.length > 0) {
      await db.update(feedFieldMappings)
        .set({
          mappings: mappings,
          updatedAt: new Date()
        })
        .where(eq(feedFieldMappings.id, existing[0].id));
    } else {
      await db.insert(feedFieldMappings)
        .values({
          domain,
          mappings,
          usageCount: 1
        });
    }

    console.log(`[FeedFieldDetector] Saved field mappings for domain: ${domain}`);
  }

  static async getMapping(domain: string): Promise<Record<string, string> | null> {
    const [mapping] = await db.select()
      .from(feedFieldMappings)
      .where(eq(feedFieldMappings.domain, domain))
      .limit(1);

    if (mapping) {
      await db.update(feedFieldMappings)
        .set({
          usageCount: (mapping.usageCount || 0) + 1,
          updatedAt: new Date()
        })
        .where(eq(feedFieldMappings.id, mapping.id));
      
      return mapping.mappings as Record<string, string>;
    }

    return null;
  }

  static extractDomain(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }
}
