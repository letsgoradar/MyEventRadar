import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"
import { nl } from "date-fns/locale"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined, formatStr: string): string {
  if (!date) return "Onbekend";

  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return format(dateObj, formatStr, { locale: nl });
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Ongeldige datum";
  }
}

export function formatDateTime(dateTimeStr: string | Date | null | undefined): string {
  if (!dateTimeStr) return "Onbekend";
  
  try {
    const dateObj = typeof dateTimeStr === "string" ? new Date(dateTimeStr) : dateTimeStr;
    const utcH = dateObj.getUTCHours(), utcM = dateObj.getUTCMinutes(), utcS = dateObj.getUTCSeconds();
    const isDateOnly = (utcH === 0 && utcM === 0 && utcS === 0) || (utcH === 23 && utcM === 59 && utcS === 59);
    if (isDateOnly) {
      return formatDate(dateTimeStr, "d MMMM yyyy") + " (tijd onbekend)";
    }
    return formatDate(dateTimeStr, "d MMMM yyyy 'om' HH:mm 'uur'");
  } catch (error) {
    console.error("Error formatting date time:", error);
    return "Ongeldige datum/tijd";
  }
}

export function formatCurrency(amount: number | string): string {
  if (!amount) return "€0,00";

  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;

  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(numAmount);
}

export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

// Calculate distance between two points in kilometers using the Haversine formula
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers

  return distance;
}

// Helper functie om een locatienaam te genereren op basis van coördinaten
export function getLocationName(lat: number, lng: number): string {
  // Vaste locatienamen voor bepaalde coördinaten (deze kan worden uitgebreid)
  const knownLocations: Record<string, string> = {
    // Formaat: "lat,lng": "locatienaam"
    "51.7767,5.5345": "Oss Centrum",
    "51.76560894885424,5.522775650024414": "Schuilkelder Oss",
    "52.3676,4.9041": "Amsterdam",
    "51.9244,4.4777": "Rotterdam",
    "52.0705,4.3007": "Den Haag",
    "52.0907,5.1214": "Utrecht",
    "51.4827,5.6873": "Eindhoven",
  };

  // Check of er een bekende locatie is, rond af op 4 decimalen
  const roundedLocation = `${Math.round(lat * 10000) / 10000},${Math.round(lng * 10000) / 10000}`;
  
  // Zoek de dichtstbijzijnde bekende locatie (binnen 0.05 graden ~5km)
  for (const [coords, name] of Object.entries(knownLocations)) {
    const [knownLat, knownLng] = coords.split(',').map(Number);
    const distance = calculateDistance(lat, lng, knownLat, knownLng);
    
    if (distance < 5) { // Binnen 5km van een bekende locatie
      return name;
    }
  }
  
  // Als er geen bekende locatie is, genereer een naam op basis van de coördinaten
  // Bepaal een regio op basis van Noord-Nederland, Midden-Nederland, of Zuid-Nederland
  let region = "";
  if (lat > 52.5) {
    region = "Noord-Nederland";
  } else if (lat > 51.8) {
    region = "Midden-Nederland";
  } else {
    region = "Zuid-Nederland";
  }
  
  return `Locatie in ${region}`;
}