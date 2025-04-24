/**
 * Locatie utiliteiten voor het tonen van gebruiksvriendelijke plaatsnamen
 * in plaats van ruwe coördinaten
 */

// Bekende Nederlandse steden met hun coördinaten en zoekradius
export const CITIES = [
  { name: "Amsterdam", lat: 52.3676, lng: 4.9041, radius: 0.2 },
  { name: "Rotterdam", lat: 51.9244, lng: 4.4777, radius: 0.2 },
  { name: "Den Haag", lat: 52.0705, lng: 4.3007, radius: 0.2 },
  { name: "Utrecht", lat: 52.0907, lng: 5.1214, radius: 0.2 },
  { name: "Eindhoven", lat: 51.4416, lng: 5.4697, radius: 0.2 },
  { name: "Groningen", lat: 53.2194, lng: 6.5665, radius: 0.2 },
  { name: "Tilburg", lat: 51.5719, lng: 5.0672, radius: 0.2 },
  { name: "Almere", lat: 52.3508, lng: 5.2647, radius: 0.2 },
  { name: "Breda", lat: 51.5719, lng: 4.7683, radius: 0.2 },
  { name: "Nijmegen", lat: 51.8426, lng: 5.8546, radius: 0.2 },
  { name: "Enschede", lat: 52.2215, lng: 6.8936, radius: 0.2 },
  { name: "Haarlem", lat: 52.3874, lng: 4.6462, radius: 0.2 },
  { name: "Arnhem", lat: 51.9851, lng: 5.8987, radius: 0.2 },
  { name: "Zaanstad", lat: 52.4537, lng: 4.8142, radius: 0.2 },
  { name: "Amersfoort", lat: 52.1561, lng: 5.3878, radius: 0.2 },
  { name: "Apeldoorn", lat: 52.2112, lng: 5.9699, radius: 0.2 },
  { name: "Den Bosch", lat: 51.6978, lng: 5.3037, radius: 0.2 },
  { name: "Oss", lat: 51.7639, lng: 5.5289, radius: 0.2 }
];

// Bekende Nederlandse provincies met hun globale coördinaten en zoekradius
export const PROVINCES = [
  { name: "Noord-Holland", lat: 52.5, lng: 4.8, radius: 0.5 },
  { name: "Zuid-Holland", lat: 52.0, lng: 4.5, radius: 0.5 },
  { name: "Utrecht", lat: 52.1, lng: 5.2, radius: 0.3 },
  { name: "Gelderland", lat: 52.0, lng: 6.0, radius: 0.7 },
  { name: "Noord-Brabant", lat: 51.7, lng: 5.3, radius: 0.7 },
  { name: "Limburg", lat: 51.2, lng: 5.9, radius: 0.5 },
  { name: "Zeeland", lat: 51.5, lng: 3.8, radius: 0.5 },
  { name: "Flevoland", lat: 52.5, lng: 5.5, radius: 0.4 },
  { name: "Overijssel", lat: 52.5, lng: 6.5, radius: 0.5 },
  { name: "Drenthe", lat: 52.9, lng: 6.6, radius: 0.5 },
  { name: "Friesland", lat: 53.1, lng: 5.8, radius: 0.5 },
  { name: "Groningen", lat: 53.2, lng: 6.6, radius: 0.5 }
];

// Bereken de afstand tussen twee punten in graden (eenvoudige benadering)
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return Math.sqrt(Math.pow(lat1 - lat2, 2) + Math.pow(lng1 - lng2, 2));
}

// Zoek de dichtbijzijnde stad op basis van coördinaten
export function findNearestCity(latitude: number, longitude: number) {
  const closest = CITIES.reduce((best: any, location) => {
    const distance = calculateDistance(latitude, longitude, location.lat, location.lng);
    if (distance < location.radius && (!best || distance < best.distance)) {
      return { ...location, distance };
    }
    return best;
  }, null);
  
  if (closest) {
    return closest.name;
  }
  
  return null;
}

// Zoek de dichtstbijzijnde provincie op basis van coördinaten
export function findNearestProvince(latitude: number, longitude: number) {
  const closest = PROVINCES.reduce((best: any, location) => {
    const distance = calculateDistance(latitude, longitude, location.lat, location.lng);
    if (!best || distance < best.distance) {
      return { ...location, distance };
    }
    return best;
  }, null);
  
  if (closest) {
    return closest.name;
  }
  
  return "Nederland";
}

// Haal een gebruiksvriendelijke locatienaam op basis van coördinaten
export function getLocationName(latitude: number, longitude: number): string {
  // Haal zowel stad als provincie op
  const city = findNearestCity(latitude, longitude);
  const province = findNearestProvince(latitude, longitude);
  
  // Als we een specifieke stad hebben, toon die samen met de provincie
  if (city) {
    return `${city} - ${province}`;
  }
  
  // Als er geen specifieke stad is gevonden, gebruik dan alleen de provincie
  return `Regio ${province}`;
}