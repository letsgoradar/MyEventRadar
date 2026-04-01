import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import turfCentroid from '@turf/centroid';
import turfBbox from '@turf/bbox';
import turfDistance from '@turf/distance';
import { readFileSync } from 'fs';
import { join } from 'path';

interface MunicipalityFeature {
  type: 'Feature';
  properties: {
    code: string;
    naam: string;
    provincie: string;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

interface GeoJsonData {
  type: 'FeatureCollection';
  features: MunicipalityFeature[];
}

let cachedGeoJson: GeoJsonData | null = null;
let municipalityPolygons: Map<string, MunicipalityFeature> = new Map();

function normalizeGemeenteName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const GEMEENTE_ALIASES: Record<string, string> = {
  'den bosch': "'s hertogenbosch",
  's hertogenbosch': "'s hertogenbosch",
  'hertogenbosch': "'s hertogenbosch",
  's-hertogenbosch': "'s hertogenbosch",
  'veghel': 'meierijstad',
  'schijndel': 'meierijstad',
  'sint oedenrode': 'meierijstad',
  'uden': 'maashorst',
  'landerd': 'maashorst',
  'oss': 'oss',
  'gilze': 'gilze en rijen',
  'rijen': 'gilze en rijen',
  'bernheze': 'bernheze',
  'eindhoven': 'eindhoven',
  'helmond': 'helmond',
  'tilburg': 'tilburg',
  'breda': 'breda',
  'oosterhout': 'oosterhout',
  'son en breugel': 'son en breugel',
  'boxtel': 'boxtel',
  'vught': 'vught',
  'etten leur': 'etten leur',
  'etten-leur': 'etten leur',
};

export interface KnownVenue {
  lat: number;
  lng: number;
  address: string;
}

export const KNOWN_VENUES: Record<string, Record<string, KnownVenue>> = {
  'meierijstad': {
    'noordkade': { lat: 51.5494, lng: 5.4603, address: 'Noordkade, Veghel' },
    'noordkade veghel': { lat: 51.5494, lng: 5.4603, address: 'Noordkade, Veghel' },
    'de chocoladefabriek': { lat: 51.5472, lng: 5.4556, address: 'De Chocoladefabriek, Veghel' },
    'chocoladefabriek': { lat: 51.5472, lng: 5.4556, address: 'De Chocoladefabriek, Veghel' },
    'chocolate factory': { lat: 51.5472, lng: 5.4556, address: 'De Chocoladefabriek, Veghel' },
    'theater de blauwe kei': { lat: 51.5521, lng: 5.4611, address: 'Theater De Blauwe Kei, Veghel' },
    'blauwe kei': { lat: 51.5521, lng: 5.4611, address: 'Theater De Blauwe Kei, Veghel' },
  },
  'breda': {
    'chassé theater': { lat: 51.5875, lng: 4.7822, address: 'Chassé Theater, Breda' },
    'chasse theater': { lat: 51.5875, lng: 4.7822, address: 'Chassé Theater, Breda' },
    'mezz': { lat: 51.5838, lng: 4.7787, address: 'Mezz, Breda' },
    'grote kerk': { lat: 51.5889, lng: 4.7753, address: 'Grote Kerk, Breda' },
    'grote markt': { lat: 51.5884, lng: 4.7762, address: 'Grote Markt, Breda' },
    'stedelijk museum': { lat: 51.5896, lng: 4.7810, address: 'Stedelijk Museum, Breda' },
    'rat verlegh stadion': { lat: 51.5846, lng: 4.7940, address: 'Rat Verlegh Stadion, Breda' },
    'nac': { lat: 51.5846, lng: 4.7940, address: 'Rat Verlegh Stadion, Breda' },
    'nassau baronie': { lat: 51.5846, lng: 4.7940, address: 'Rat Verlegh Stadion, Breda' },
    'barones': { lat: 51.5881, lng: 4.7739, address: 'De Barones, Breda' },
  },
  "'s hertogenbosch": {
    'theater aan de parade': { lat: 51.6875, lng: 5.3055, address: 'Theater aan de Parade, Den Bosch' },
    'verkadefabriek': { lat: 51.6852, lng: 5.3180, address: 'Verkadefabriek, Den Bosch' },
    'w2': { lat: 51.6852, lng: 5.3180, address: 'W2, Den Bosch' },
    'sint jan': { lat: 51.6874, lng: 5.3077, address: 'Sint-Janskathedraal, Den Bosch' },
    'markt': { lat: 51.6876, lng: 5.3047, address: 'Markt, Den Bosch' },
  },
  'oss': {
    'de lievekamp': { lat: 51.7649, lng: 5.5268, address: 'De Lievekamp, Oss' },
    'lievekamp': { lat: 51.7649, lng: 5.5268, address: 'De Lievekamp, Oss' },
    'groene engel': { lat: 51.7660, lng: 5.5287, address: 'Groene Engel, Oss' },
  },
  'wageningen': {
    'impulse': { lat: 51.9840, lng: 5.6620, address: 'Impulse, Wageningen' },
    'café daniels': { lat: 51.9653, lng: 5.6642, address: 'Café Daniels, Wageningen' },
    'cafe daniels': { lat: 51.9653, lng: 5.6642, address: 'Café Daniels, Wageningen' },
    'grote kerk wageningen': { lat: 51.9649, lng: 5.6628, address: 'Grote Kerk, Wageningen' },
    'grote kerk': { lat: 51.9649, lng: 5.6628, address: 'Grote Kerk, Wageningen' },
    'arboretum belmonte': { lat: 51.9663, lng: 5.6899, address: 'Arboretum Belmonte, Wageningen' },
    'arboretumkerk': { lat: 51.9678, lng: 5.6745, address: 'Arboretumkerk, Wageningen' },
    'theater de wilde wereld': { lat: 51.9649, lng: 5.6644, address: 'Theater de Wilde Wereld, Wageningen' },
    'wilde wereld': { lat: 51.9649, lng: 5.6644, address: 'Theater de Wilde Wereld, Wageningen' },
    'immanuëlkerk': { lat: 51.9730, lng: 5.6587, address: 'Immanuëlkerk, Wageningen' },
    'immanuelkerk': { lat: 51.9730, lng: 5.6587, address: 'Immanuëlkerk, Wageningen' },
    'ontmoetingshuis de vrijheid': { lat: 51.9654, lng: 5.6609, address: 'Ontmoetingshuis De Vrijheid, Wageningen' },
    'de vrijheid': { lat: 51.9654, lng: 5.6609, address: 'Ontmoetingshuis De Vrijheid, Wageningen' },
    "'t stek": { lat: 51.9682, lng: 5.6595, address: "'t Stek, Wageningen" },
    't venster': { lat: 51.9682, lng: 5.6595, address: "'t Venster, Wageningen" },
    'theater junushoff': { lat: 51.9651, lng: 5.6664, address: 'Theater Junushoff, Wageningen' },
    'junushoff': { lat: 51.9651, lng: 5.6664, address: 'Theater Junushoff, Wageningen' },
    'bibliotheek wageningen': { lat: 51.9652, lng: 5.6594, address: 'Bibliotheek Wageningen' },
    'forumgebouw': { lat: 51.9864, lng: 5.6646, address: 'Forumgebouw, Wageningen Campus' },
    'forum wageningen': { lat: 51.9864, lng: 5.6646, address: 'Forumgebouw, Wageningen Campus' },
    "landgoed oranje nassau's oord": { lat: 51.9734, lng: 5.7064, address: "Landgoed Oranje Nassau's Oord" },
    'oranje nassau': { lat: 51.9734, lng: 5.7064, address: "Landgoed Oranje Nassau's Oord" },
    'museum de casteelse poort': { lat: 51.9656, lng: 5.6614, address: 'Museum De Casteelse Poort, Wageningen' },
    'casteelse poort': { lat: 51.9656, lng: 5.6614, address: 'Museum De Casteelse Poort, Wageningen' },
    'nudetoekomst': { lat: 51.9660, lng: 5.6640, address: 'NuDeToekomst, Wageningen' },
    'nurdspace': { lat: 51.9699, lng: 5.6667, address: 'Stichting NURDspace, Wageningen' },
    'de blauwe kamer': { lat: 51.9620, lng: 5.6879, address: 'De Blauwe Kamer, Wageningen' },
    'blauwe kamer': { lat: 51.9620, lng: 5.6879, address: 'De Blauwe Kamer, Wageningen' },
    'wijkcentrum de pomhorst': { lat: 51.9716, lng: 5.6514, address: 'Wijkcentrum De Pomhorst, Wageningen' },
    'pomhorst': { lat: 51.9716, lng: 5.6514, address: 'Wijkcentrum De Pomhorst, Wageningen' },
    'heel wageningen': { lat: 51.9644, lng: 5.6647, address: 'Wageningen' },
  },
  'wijchen': {
    'wijchen centrum': { lat: 51.8073, lng: 5.7395, address: 'Wijchen centrum, Wijchen' },
    'wijchen overig': { lat: 51.8069, lng: 5.7381, address: 'Wijchen' },
    'balgoij': { lat: 51.7844, lng: 5.7551, address: 'Balgoij, Wijchen' },
    'niftrik': { lat: 51.7985, lng: 5.7544, address: 'Niftrik, Wijchen' },
    'alverna': { lat: 51.8110, lng: 5.7086, address: 'Alverna, Wijchen' },
    'woezik': { lat: 51.8206, lng: 5.7444, address: 'Woezik, Wijchen' },
    'kasteel wijchen': { lat: 51.8100, lng: 5.7247, address: 'Kasteel Wijchen, Wijchen' },
    'cinema roma': { lat: 51.8100, lng: 5.7252, address: 'Cinema Roma, Wijchen' },
    'café anneke': { lat: 51.8079, lng: 5.7389, address: 'Café Anneke, Wijchen' },
    'cafe anneke': { lat: 51.8079, lng: 5.7389, address: 'Café Anneke, Wijchen' },
    'anneke': { lat: 51.8079, lng: 5.7389, address: 'Café Anneke, Wijchen' },
    'de markt': { lat: 51.8073, lng: 5.7380, address: 'De Markt, Wijchen' },
    'zwembad de meerval': { lat: 51.8026, lng: 5.7307, address: 'Zwembad De Meerval, Wijchen' },
    'meerval': { lat: 51.8026, lng: 5.7307, address: 'Zwembad De Meerval, Wijchen' },
    'kasteel hernen': { lat: 51.7922, lng: 5.7572, address: 'Kasteel Hernen, Hernen' },
    'hernen': { lat: 51.7922, lng: 5.7572, address: 'Hernen, Wijchen' },
  },
  'dordrecht': {
    // Dordrecht stad
    'grote kerk': { lat: 51.8134, lng: 4.6688, address: 'Grote Kerk, Dordrecht' },
    'de gravenhorst': { lat: 51.8003, lng: 4.6871, address: 'De Gravenhorst, Dordrecht' },
    'gravenhorst': { lat: 51.8003, lng: 4.6871, address: 'De Gravenhorst, Dordrecht' },
    'wantijpark': { lat: 51.8186, lng: 4.6846, address: 'Wantijpark, Dordrecht' },
    'nieuwkerksplein': { lat: 51.8141, lng: 4.6702, address: 'Nieuwkerksplein, Dordrecht' },
    'sikkelstraat': { lat: 51.8146, lng: 4.6595, address: 'Sikkelstraat, Dordrecht' },
    'ontmoetingsplek dubbeldammers': { lat: 51.8216, lng: 4.6635, address: 'Ontmoetingsplek Dubbeldammers (De Kooi), Dordrecht' },
    'dubbeldammers': { lat: 51.8216, lng: 4.6635, address: 'Ontmoetingsplek Dubbeldammers (De Kooi), Dordrecht' },
    'de kooi': { lat: 51.8216, lng: 4.6635, address: 'De Kooi, Dordrecht' },
    'de moestuin': { lat: 51.8083, lng: 4.6935, address: 'De Moestuin, Dordrecht' },
    'van bearleplantsoen': { lat: 51.8083, lng: 4.6935, address: 'Van Bearleplantsoen, Dordrecht' },
    'schouwburg': { lat: 51.8120, lng: 4.6672, address: 'Schouwburg Kunstmin, Dordrecht' },
    'kunstmin': { lat: 51.8120, lng: 4.6672, address: 'Schouwburg Kunstmin, Dordrecht' },
    'energiehuis': { lat: 51.8091, lng: 4.6692, address: 'Energiehuis, Dordrecht' },
    'dordtse hout': { lat: 51.8255, lng: 4.6830, address: 'Dordtse Hout, Dordrecht' },
    'bibelot': { lat: 51.8081, lng: 4.6738, address: 'Bibelot, Dordrecht' },
    // Zwijndrecht venues die in de Dordrecht-feed verschijnen
    'kubiek': { lat: 51.8214, lng: 4.6367, address: 'Kubiek, Zwijndrecht' },
    'zwaluwstraat': { lat: 51.8214, lng: 4.6367, address: 'Kubiek, Zwijndrecht' },
    // Papendrecht venues die in de Dordrecht-feed verschijnen
    'de spil': { lat: 51.8374, lng: 4.6913, address: 'De Spil, Papendrecht' },
    'stellingmolen': { lat: 51.8374, lng: 4.6913, address: 'De Spil, Papendrecht' },
    'theater de spil': { lat: 51.8374, lng: 4.6913, address: 'De Spil, Papendrecht' },
  },
  'zwijndrecht': {
    // Zwijndrecht (Drechtsteden) — verschijnt in de Dordrecht-feed
    'kubiek': { lat: 51.8214, lng: 4.6367, address: 'Kubiek, Zwijndrecht' },
    'zwaluwstraat': { lat: 51.8214, lng: 4.6367, address: 'Kubiek, Zwijndrecht' },
  },
  'papendrecht': {
    // Papendrecht (Drechtsteden) — verschijnt in de Dordrecht-feed
    'de spil': { lat: 51.8374, lng: 4.6913, address: 'De Spil, Papendrecht' },
    'stellingmolen': { lat: 51.8374, lng: 4.6913, address: 'De Spil, Papendrecht' },
    'theater de spil': { lat: 51.8374, lng: 4.6913, address: 'De Spil, Papendrecht' },
  },
};

export function getKnownVenue(municipality: string, venueName: string): KnownVenue | null {
  const normalizedMunicipality = normalizeGemeenteName(municipality);
  const normalizedVenue = venueName.toLowerCase().trim();
  
  const municipalityKey = GEMEENTE_ALIASES[normalizedMunicipality] || normalizedMunicipality;
  const venues = KNOWN_VENUES[municipalityKey];
  
  if (!venues) return null;
  
  if (venues[normalizedVenue]) {
    return venues[normalizedVenue];
  }
  
  for (const [key, venue] of Object.entries(venues)) {
    if (normalizedVenue.includes(key) || key.includes(normalizedVenue)) {
      return venue;
    }
  }
  
  return null;
}

let geoJsonLoadError: string | null = null;

function loadGeoJson(): GeoJsonData | null {
  if (cachedGeoJson) return cachedGeoJson;
  if (geoJsonLoadError) return null;
  
  try {
    const filePath = join(process.cwd(), 'public/assets/gemeenten-simplified.json');
    const data = readFileSync(filePath, 'utf-8');
    cachedGeoJson = JSON.parse(data) as GeoJsonData;
    
    for (const feature of cachedGeoJson.features) {
      const normalizedName = normalizeGemeenteName(feature.properties.naam);
      municipalityPolygons.set(normalizedName, feature);
      
      const code = feature.properties.code;
      municipalityPolygons.set(code, feature);
    }
    
    console.log(`[MunicipalityValidator] Loaded ${cachedGeoJson.features.length} municipality polygons`);
    return cachedGeoJson;
  } catch (error: any) {
    geoJsonLoadError = error.message;
    console.warn(`[MunicipalityValidator] Could not load GeoJSON: ${error.message}. Validation will be skipped.`);
    return null;
  }
}

function findMunicipalityPolygon(municipalityName: string): MunicipalityFeature | null {
  loadGeoJson();
  
  const normalized = normalizeGemeenteName(municipalityName);
  
  if (municipalityPolygons.has(normalized)) {
    return municipalityPolygons.get(normalized)!;
  }
  
  const aliasKey = GEMEENTE_ALIASES[normalized];
  if (aliasKey && municipalityPolygons.has(aliasKey)) {
    return municipalityPolygons.get(aliasKey)!;
  }
  
  for (const [key, polygon] of Array.from(municipalityPolygons.entries())) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return polygon;
    }
  }
  
  return null;
}

export interface ValidationResult {
  isValid: boolean;
  municipality?: string;
  distance?: number;
  message: string;
}

export function validateCoordinatesInMunicipality(
  latitude: number,
  longitude: number,
  expectedMunicipality: string
): ValidationResult {
  const polygon = findMunicipalityPolygon(expectedMunicipality);
  
  if (!polygon) {
    console.warn(`[MunicipalityValidator] Polygon not found for "${expectedMunicipality}" - allowing coordinates (graceful degradation)`);
    return {
      isValid: true,
      message: `Municipality polygon not found for: ${expectedMunicipality} - validation skipped`
    };
  }
  
  const pt = point([longitude, latitude]);
  const isInside = booleanPointInPolygon(pt, polygon as any);
  
  if (isInside) {
    return {
      isValid: true,
      municipality: polygon.properties?.naam || expectedMunicipality,
      message: 'Coordinates are within municipality boundaries'
    };
  }
  
  try {
    const center = turfCentroid(polygon as any);
    const dist = turfDistance(pt, center, { units: 'kilometers' });
    
    return {
      isValid: false,
      municipality: polygon.properties?.naam,
      distance: Math.round(dist * 10) / 10,
      message: `Coordinates (${latitude}, ${longitude}) are ${dist.toFixed(1)}km outside ${expectedMunicipality}`
    };
  } catch {
    return {
      isValid: false,
      message: `Coordinates (${latitude}, ${longitude}) are outside ${expectedMunicipality}`
    };
  }
}

export function getMunicipalityCentroid(municipalityName: string): { lat: number; lng: number } | null {
  const polygon = findMunicipalityPolygon(municipalityName);
  
  if (!polygon) {
    console.log(`[MunicipalityValidator] No polygon found for: ${municipalityName}`);
    return null;
  }
  
  try {
    const center = turfCentroid(polygon as any);
    return {
      lat: center.geometry.coordinates[1],
      lng: center.geometry.coordinates[0]
    };
  } catch (error) {
    console.error(`[MunicipalityValidator] Error calculating centroid for ${municipalityName}:`, error);
    return null;
  }
}

export function findActualMunicipality(latitude: number, longitude: number): string | null {
  const geoJson = loadGeoJson();
  if (!geoJson) return null;
  
  const pt = point([longitude, latitude]);
  
  for (const feature of geoJson.features) {
    try {
      if (booleanPointInPolygon(pt, feature as any)) {
        return feature.properties.naam;
      }
    } catch {
      continue;
    }
  }
  
  return null;
}

export function getMunicipalityBoundingBox(municipalityName: string): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} | null {
  const polygon = findMunicipalityPolygon(municipalityName);
  
  if (!polygon) return null;
  
  try {
    const bb = turfBbox(polygon as any);
    return {
      minLng: bb[0],
      minLat: bb[1],
      maxLng: bb[2],
      maxLat: bb[3]
    };
  } catch {
    return null;
  }
}

export function isCoordinateInNoordBrabant(latitude: number, longitude: number): boolean {
  const geoJson = loadGeoJson();
  if (!geoJson) return false;
  
  const pt = point([longitude, latitude]);
  
  for (const feature of geoJson.features) {
    if (feature.properties.provincie === 'Noord-Brabant') {
      try {
        if (booleanPointInPolygon(pt, feature as any)) {
          return true;
        }
      } catch {
        continue;
      }
    }
  }
  
  return false;
}

export function getNoordBrabantMunicipalities(): string[] {
  const geoJson = loadGeoJson();
  if (!geoJson) return [];
  
  return geoJson.features
    .filter(f => f.properties.provincie === 'Noord-Brabant')
    .map(f => f.properties.naam);
}
