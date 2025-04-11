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
  
  // Bepaal de basiskleuren voor elke categorie
  const colorMap: Record<typeof CATEGORIES[number], string> = {
    "Sport en spel": "#4CAF50", // groen
    "Kunst en Cultuur": "#FFEB3B", // geel
    "Gezellig en Sociaal": "#2196F3", // blauw
    "Leren en Ontdekken": "#9C27B0", // paars
    "Vrijwilligerswerk en hulp": "#F44336", // rood
  };
  
  // Creëer een subtiele kleurvariatie op basis van de titel
  const baseColor = colorMap[category] || "#607D8B"; // grijs als fallback
  
  // Genereer een lichte variatie in de kleur met een hash van de titel
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Creëer een lichte variatie op de basiskleur
  const r = parseInt(baseColor.slice(1, 3), 16);
  const g = parseInt(baseColor.slice(3, 5), 16);
  const b = parseInt(baseColor.slice(5, 7), 16);
  
  // Voeg een subtiele variatie toe
  const variation = hash % 60 - 30; // -30 tot +30
  
  // Beperk de kleurwaarden tussen 0 en 255
  const newR = Math.min(255, Math.max(0, r + variation));
  const newG = Math.min(255, Math.max(0, g + variation));
  const newB = Math.min(255, Math.max(0, b + variation));
  
  const color = `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  
  // Extraheer een korte versie van de titel
  const shortTitle = title.slice(0, 20) + (title.length > 20 ? "..." : "");
  
  // Bepaal een patroon op basis van de titel om visuele variatie te creëren
  const pattern = hash % 5;
  let patternSvg = '';
  
  if (pattern === 0) {
    // Stippen patroon
    patternSvg = `
      <circle cx="100" cy="100" r="50" fill="${color}" opacity="0.3" />
      <circle cx="300" cy="200" r="70" fill="${color}" opacity="0.3" />
    `;
  } else if (pattern === 1) {
    // Strepen patroon
    patternSvg = `
      <rect x="30" y="30" width="340" height="30" fill="${color}" opacity="0.2" />
      <rect x="30" y="240" width="340" height="30" fill="${color}" opacity="0.2" />
    `;
  } else if (pattern === 2) {
    // Diagonale lijn
    patternSvg = `
      <rect x="0" y="0" width="400" height="300" fill="${color}" opacity="0.05" />
      <line x1="0" y1="0" x2="400" y2="300" stroke="${color}" stroke-width="20" opacity="0.2" />
    `;
  } else if (pattern === 3) {
    // Ruitpatroon
    patternSvg = `
      <rect x="0" y="0" width="400" height="300" fill="${color}" opacity="0.05" />
      <rect x="100" y="50" width="200" height="200" stroke="${color}" fill="none" stroke-width="10" opacity="0.3" />
    `;
  } else {
    // Cirkels
    patternSvg = `
      <circle cx="200" cy="150" r="100" stroke="${color}" fill="none" stroke-width="15" opacity="0.2" />
      <circle cx="200" cy="150" r="50" stroke="${color}" fill="none" stroke-width="8" opacity="0.3" />
    `;
  }
  
  // Genereer een SVG met variatie in ontwerp
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${color};stop-opacity:0.8" />
        <stop offset="100%" style="stop-color:${color};stop-opacity:0.5" />
      </linearGradient>
    </defs>
    <rect width="400" height="300" fill="url(#grad)" />
    ${patternSvg}
    <text x="50%" y="50%" font-family="Arial" font-size="24" fill="white" text-anchor="middle" font-weight="bold">${category}</text>
    ${title ? `<text x="50%" y="65%" font-family="Arial" font-size="18" fill="white" text-anchor="middle">${shortTitle}</text>` : ''}
  </svg>
  `;
  
  // Converteer de SVG naar een data URL
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}