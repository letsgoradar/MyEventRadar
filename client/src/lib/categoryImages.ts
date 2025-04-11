import { CATEGORIES } from '@shared/schema';

// Definitie van standaardafbeeldingen per categorie
// We gebruiken publiek beschikbare SVG illustraties die representatief zijn voor elke categorie
export const CATEGORY_IMAGES: Record<typeof CATEGORIES[number], string[]> = {
  "Sport en spel": [
    "/images/categories/sport-1.svg",
    "/images/categories/sport-2.svg",
    "/images/categories/sport-3.svg",
  ],
  "Kunst en Cultuur": [
    "/images/categories/kunst-1.svg",
    "/images/categories/kunst-2.svg",
    "/images/categories/kunst-3.svg",
  ],
  "Gezellig en Sociaal": [
    "/images/categories/sociaal-1.svg",
    "/images/categories/sociaal-2.svg",
    "/images/categories/sociaal-3.svg",
  ],
  "Leren en Ontdekken": [
    "/images/categories/leren-1.svg",
    "/images/categories/leren-2.svg",
    "/images/categories/leren-3.svg",
  ],
  "Vrijwilligerswerk en hulp": [
    "/images/categories/vrijwilligers-1.svg",
    "/images/categories/vrijwilligers-2.svg",
    "/images/categories/vrijwilligers-3.svg",
  ],
};

// Placeholder afbeelding wanneer er geen categorie is geselecteerd
export const DEFAULT_IMAGE = "/images/event-logo.svg";

// Functie om afbeeldingen te krijgen voor een bepaalde categorie
export function getCategoryImages(category: typeof CATEGORIES[number] | string): string[] {
  if (category in CATEGORY_IMAGES) {
    return CATEGORY_IMAGES[category as typeof CATEGORIES[number]];
  }
  return [DEFAULT_IMAGE];
}

// Functie om een representatieve voorbeeldillustratie te genereren op basis van categorie en tekst
export function generateSVGForCategory(category: typeof CATEGORIES[number], title: string = ""): string {
  // We genereren een eenvoudige SVG met kleur op basis van de categorie
  // en tonen een deel van de titel (indien beschikbaar)
  
  // Bepaal de kleur op basis van de categorie
  const colorMap: Record<typeof CATEGORIES[number], string> = {
    "Sport en spel": "#4CAF50", // groen
    "Kunst en Cultuur": "#FFEB3B", // geel
    "Gezellig en Sociaal": "#2196F3", // blauw
    "Leren en Ontdekken": "#9C27B0", // paars
    "Vrijwilligerswerk en hulp": "#F44336", // rood
  };
  
  const color = colorMap[category] || "#607D8B"; // grijs als fallback
  
  // Extraheer een korte versie van de titel
  const shortTitle = title.slice(0, 20) + (title.length > 20 ? "..." : "");
  
  // Genereer een eenvoudige SVG met een kleurverloop en tekst
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${color};stop-opacity:0.8" />
        <stop offset="100%" style="stop-color:${color};stop-opacity:0.5" />
      </linearGradient>
    </defs>
    <rect width="400" height="300" fill="url(#grad)" />
    <text x="50%" y="50%" font-family="Arial" font-size="24" fill="white" text-anchor="middle">${category}</text>
    ${title ? `<text x="50%" y="65%" font-family="Arial" font-size="18" fill="white" text-anchor="middle">${shortTitle}</text>` : ''}
  </svg>
  `;
  
  // Converteer de SVG naar een data URL
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}