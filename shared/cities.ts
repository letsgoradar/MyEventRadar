export interface CityConfig {
  slug: string;
  name: string;
  province: string;
  provinceSlug: string;
  latitude: number;
  longitude: number;
  population?: number;
  description?: string;
  isActive: boolean;
}

export interface ProvinceConfig {
  slug: string;
  name: string;
  cities: string[];
}

export const PROVINCES: ProvinceConfig[] = [
  {
    slug: 'noord-brabant',
    name: 'Noord-Brabant',
    cities: ['tilburg', 'breda', 'den-bosch', 'eindhoven', 'oss', 'helmond', 'bergen-op-zoom', 'roosendaal', 'oosterhout', 'waalwijk', 'veghel', 'uden']
  },
  {
    slug: 'limburg',
    name: 'Limburg',
    cities: ['maastricht', 'venlo', 'heerlen', 'sittard', 'roermond', 'weert']
  },
  {
    slug: 'gelderland',
    name: 'Gelderland',
    cities: ['nijmegen', 'arnhem', 'apeldoorn', 'ede', 'doetinchem']
  },
  {
    slug: 'zuid-holland',
    name: 'Zuid-Holland',
    cities: ['rotterdam', 'den-haag', 'leiden', 'dordrecht', 'delft', 'gouda']
  },
  {
    slug: 'noord-holland',
    name: 'Noord-Holland',
    cities: ['amsterdam', 'haarlem', 'zaandam', 'alkmaar', 'hilversum']
  },
  {
    slug: 'utrecht',
    name: 'Utrecht',
    cities: ['utrecht', 'amersfoort', 'veenendaal', 'nieuwegein', 'zeist']
  }
];

export const CITIES: CityConfig[] = [
  { slug: 'tilburg', name: 'Tilburg', province: 'Noord-Brabant', provinceSlug: 'noord-brabant', latitude: 51.5555, longitude: 5.0913, population: 224702, isActive: true },
  { slug: 'breda', name: 'Breda', province: 'Noord-Brabant', provinceSlug: 'noord-brabant', latitude: 51.5719, longitude: 4.7683, population: 184403, isActive: true },
  { slug: 'den-bosch', name: "'s-Hertogenbosch", province: 'Noord-Brabant', provinceSlug: 'noord-brabant', latitude: 51.6978, longitude: 5.3037, population: 157769, isActive: true },
  { slug: 'eindhoven', name: 'Eindhoven', province: 'Noord-Brabant', provinceSlug: 'noord-brabant', latitude: 51.4416, longitude: 5.4697, population: 238478, isActive: true },
  { slug: 'oss', name: 'Oss', province: 'Noord-Brabant', provinceSlug: 'noord-brabant', latitude: 51.7649, longitude: 5.5180, population: 93907, isActive: true },
  { slug: 'helmond', name: 'Helmond', province: 'Noord-Brabant', provinceSlug: 'noord-brabant', latitude: 51.4817, longitude: 5.6611, population: 93472, isActive: true },
  { slug: 'bergen-op-zoom', name: 'Bergen op Zoom', province: 'Noord-Brabant', provinceSlug: 'noord-brabant', latitude: 51.4949, longitude: 4.2911, population: 67342, isActive: false },
  { slug: 'roosendaal', name: 'Roosendaal', province: 'Noord-Brabant', provinceSlug: 'noord-brabant', latitude: 51.5308, longitude: 4.4653, population: 77339, isActive: false },
  { slug: 'oosterhout', name: 'Oosterhout', province: 'Noord-Brabant', provinceSlug: 'noord-brabant', latitude: 51.6450, longitude: 4.8600, population: 55786, isActive: false },
  { slug: 'waalwijk', name: 'Waalwijk', province: 'Noord-Brabant', provinceSlug: 'noord-brabant', latitude: 51.6833, longitude: 5.0667, population: 48699, isActive: false },
  { slug: 'veghel', name: 'Veghel', province: 'Noord-Brabant', provinceSlug: 'noord-brabant', latitude: 51.6167, longitude: 5.5500, population: 38000, isActive: true },
  { slug: 'uden', name: 'Uden', province: 'Noord-Brabant', provinceSlug: 'noord-brabant', latitude: 51.6600, longitude: 5.6200, population: 42000, isActive: false },
  { slug: 'maastricht', name: 'Maastricht', province: 'Limburg', provinceSlug: 'limburg', latitude: 50.8514, longitude: 5.6909, population: 121565, isActive: false },
  { slug: 'nijmegen', name: 'Nijmegen', province: 'Gelderland', provinceSlug: 'gelderland', latitude: 51.8126, longitude: 5.8372, population: 177766, isActive: true },
  { slug: 'amsterdam', name: 'Amsterdam', province: 'Noord-Holland', provinceSlug: 'noord-holland', latitude: 52.3676, longitude: 4.9041, population: 872680, isActive: false },
  { slug: 'rotterdam', name: 'Rotterdam', province: 'Zuid-Holland', provinceSlug: 'zuid-holland', latitude: 51.9225, longitude: 4.4792, population: 651446, isActive: false },
  { slug: 'utrecht', name: 'Utrecht', province: 'Utrecht', provinceSlug: 'utrecht', latitude: 52.0907, longitude: 5.1214, population: 361924, isActive: false },
];

export function getCityBySlug(slug: string): CityConfig | undefined {
  return CITIES.find(city => city.slug === slug);
}

export function getActiveCities(): CityConfig[] {
  return CITIES.filter(city => city.isActive);
}

export function getCitiesByProvince(provinceSlug: string): CityConfig[] {
  return CITIES.filter(city => city.provinceSlug === provinceSlug);
}

export function getProvinceBySlug(slug: string): ProvinceConfig | undefined {
  return PROVINCES.find(province => province.slug === slug);
}

export function getAllProvinces(): ProvinceConfig[] {
  return PROVINCES;
}

export function generateCityUrl(city: CityConfig): string {
  return `/${city.provinceSlug}/${city.slug}`;
}

export function generateCityEventsUrl(city: CityConfig): string {
  return `/${city.provinceSlug}/${city.slug}/evenementen`;
}

export function generateCityCategoryUrl(city: CityConfig, categorySlug: string): string {
  return `/${city.provinceSlug}/${city.slug}/${categorySlug}`;
}
