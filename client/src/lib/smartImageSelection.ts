// Slimme afbeelding selectie gebaseerd op titel en beschrijving alleen
// Volledig losgekoppeld van categorieën

export const ALL_ACTIVITY_IMAGES = [
  // Sport & activiteiten afbeeldingen (betrouwbare werkende URLs)
  "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400&h=300&fit=crop&auto=format", // Voetbal
  "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400&h=300&fit=crop&auto=format", // Tennis
  "https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=400&h=300&fit=crop&auto=format", // Basketball
  "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=400&h=300&fit=crop&auto=format", // Fitness
  "https://images.unsplash.com/photo-1544717297-fa95b6ee9643?w=400&h=300&fit=crop&auto=format", // Running
  "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&h=300&fit=crop&auto=format", // Cycling
  "https://images.unsplash.com/photo-1571115177098-24ec42ed204d?w=400&h=300&fit=crop&auto=format", // Swimming
  "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=300&fit=crop&auto=format", // Yoga
  "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop&auto=format", // Music
  "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&h=300&fit=crop&auto=format", // Art
  "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop&auto=format", // Cooking
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=300&fit=crop&auto=format", // Nature
  "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400&h=300&fit=crop&auto=format", // Party
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=300&fit=crop&auto=format", // Dance
  "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400&h=300&fit=crop&auto=format", // Festival
  "https://images.unsplash.com/photo-1471478331149-c72f17e33c73?w=400&h=300&fit=crop&auto=format", // Concert
  "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=400&h=300&fit=crop&auto=format", // Workshop
  "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=300&fit=crop&auto=format", // Education
  "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=300&fit=crop&auto=format", // Community
  "https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=400&h=300&fit=crop&auto=format", // Volunteer
  "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop&auto=format", // Garden
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop&auto=format", // Culture
  "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=300&fit=crop&auto=format", // Technology
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop&auto=format", // Outdoor

];

// Keyword mapping voor slimme afbeelding selectie (aangepast voor 24 afbeeldingen)
const KEYWORD_MAPPINGS = {
  // Sport keywords
  voetbal: [0, 1, 2, 3],
  soccer: [0, 1, 2, 3],
  football: [0, 1, 2, 3],
  
  tennis: [1, 2, 3, 4],
  padel: [1, 2, 3, 4],
  
  basketbal: [2, 3, 4, 5],
  basketball: [2, 3, 4, 5],
  
  fitness: [3, 4, 5, 6],
  gym: [3, 4, 5, 6],
  workout: [3, 4, 5, 6],
  training: [3, 4, 5, 6],
  
  hardlopen: [4, 5, 6, 7],
  running: [4, 5, 6, 7],
  marathon: [4, 5, 6, 7],
  
  fietsen: [5, 6, 7, 8],
  cycling: [5, 6, 7, 8],
  fiets: [5, 6, 7, 8],
  
  zwemmen: [6, 7, 8, 9],
  swimming: [6, 7, 8, 9],
  zwembad: [6, 7, 8, 9],
  pool: [6, 7, 8, 9],
  zwemfeest: [6, 7, 8, 9],
  
  yoga: [7, 8, 9, 10],
  meditation: [7, 8, 9, 10],
  mindfulness: [7, 8, 9, 10],
  
  // Muziek keywords
  piano: [8, 9, 10, 11],
  keyboard: [8, 9, 10, 11],
  
  gitaar: [8, 9, 10, 11],
  guitar: [8, 9, 10, 11],
  
  concert: [8, 9, 15, 16],
  muziek: [8, 9, 15, 16],
  music: [8, 9, 15, 16],
  optreden: [8, 9, 15, 16],
  live: [8, 9, 15, 16],
  band: [8, 9, 15, 16],
  
  dj: [8, 9, 15, 16],
  elektronisch: [8, 9, 15, 16],
  
  // Kunst keywords
  schilderen: [9, 10, 11, 12],
  verf: [9, 10, 11, 12],
  kwast: [9, 10, 11, 12],
  tekenen: [9, 10, 11, 12],
  
  fotografie: [9, 10, 11, 12],
  foto: [9, 10, 11, 12],
  camera: [9, 10, 11, 12],
  
  theater: [13, 14, 15, 16],
  toneel: [13, 14, 15, 16],
  dans: [13, 14, 15, 16],
  dance: [13, 14, 15, 16],
  
  // Koken keywords 
  koken: [10, 11, 12, 13],
  cooking: [10, 11, 12, 13],
  recepten: [10, 11, 12, 13],
  chef: [10, 11, 12, 13],
  eten: [10, 11, 12, 13],
  
  bbq: [10, 11, 12, 13],
  barbecue: [10, 11, 12, 13],
  grill: [10, 11, 12, 13],
  
  // Sociale keywords 
  feest: [12, 13, 14, 15],
  party: [12, 13, 14, 15],
  verjaardag: [12, 13, 14, 15],
  sociaal: [18, 19, 20, 21],
  gezellig: [12, 13, 14, 15],
  
  // Leren keywords
  boek: [17, 18, 19, 20],
  lezen: [17, 18, 19, 20],
  bibliotheek: [17, 18, 19, 20],
  
  workshop: [16, 17, 18, 19],
  cursus: [16, 17, 18, 19],
  les: [17, 18, 19, 20],
  
  // Gaming keywords
  gaming: [22, 23, 0, 1],
  game: [22, 23, 0, 1],
  esports: [22, 23, 0, 1],
  
  // Natuur keywords 
  natuur: [11, 12, 23, 0],
  wandelen: [11, 12, 23, 0],
  hiking: [11, 12, 23, 0],
  buitenactiviteit: [11, 12, 23, 0],
  outdoor: [23, 0, 1, 2],
  
  // Vrijwilligerswerk keywords
  vrijwilliger: [18, 19, 20, 21],
  volunteer: [18, 19, 20, 21],
  hulp: [18, 19, 20, 21],
  
  // Tech keywords
  programmeren: [22, 23, 0, 1],
  coding: [22, 23, 0, 1],
  tech: [22, 23, 0, 1],
  computer: [22, 23, 0, 1],
  
  // Cultuur keywords
  cultuur: [21, 22, 23, 0],
  festival: [14, 15, 16, 17],
  evenement: [12, 13, 14, 15],
};

export function getSmartImage(title: string, description: string = ""): { image: string | null, hasMatch: boolean } {
  const combinedText = `${title} ${description}`.toLowerCase();
  
  // Zoek naar keywords in de tekst
  const matchedImages: number[] = [];
  
  for (const [keyword, imageIndices] of Object.entries(KEYWORD_MAPPINGS)) {
    if (combinedText.includes(keyword)) {
      matchedImages.push(...imageIndices);
      console.log(`Keyword "${keyword}" gevonden - afbeelding indices toegevoegd:`, imageIndices);
    }
  }
  
  // Als we matches hebben, kies een willekeurige uit de matches
  if (matchedImages.length > 0) {
    const randomIndex = matchedImages[Math.floor(Math.random() * matchedImages.length)];
    const selectedImage = ALL_ACTIVITY_IMAGES[randomIndex];
    console.log(`Slimme selectie: "${title}" -> afbeelding ${randomIndex} (${selectedImage})`);
    return { image: selectedImage, hasMatch: true };
  }
  
  // Geen match gevonden - suggereer AI generatie
  console.log(`Geen passende afbeelding gevonden voor "${title}" - suggereer AI generatie`);
  return { image: null, hasMatch: false };
}

// Nieuwe functie: zoek afbeeldingen op basis van alleen een keyword (alleen voor handmatige zoekopdrachten)
export function searchImagesByKeyword(keyword: string, count: number = 8): {
  images: string[],
  hasMatch: boolean
} {
  const searchTerm = keyword.toLowerCase().trim();
  
  if (!searchTerm) {
    // Leeg zoekveld - toon alle afbeeldingen
    return {
      images: ALL_ACTIVITY_IMAGES.slice(0, count),
      hasMatch: false
    };
  }
  
  // Zoek naar keywords die de zoekterm bevatten
  const matchedImages: number[] = [];
  
  for (const [keyword, imageIndices] of Object.entries(KEYWORD_MAPPINGS)) {
    if (keyword.includes(searchTerm) || searchTerm.includes(keyword)) {
      matchedImages.push(...imageIndices);
    }
  }
  
  if (matchedImages.length > 0) {
    // Verwijder duplicaten
    const uniqueIndices: number[] = [];
    const seen = new Set<number>();
    for (const index of matchedImages) {
      if (!seen.has(index)) {
        seen.add(index);
        uniqueIndices.push(index);
      }
    }
    
    // Selecteer tot 'count' aantal afbeeldingen
    const selectedIndices = uniqueIndices.slice(0, Math.min(count, uniqueIndices.length));
    const selectedImages = selectedIndices
      .map(index => ALL_ACTIVITY_IMAGES[index])
      .filter(image => image && typeof image === 'string');
    
    // Als we minder matches hebben dan gewenst, vul aan met algemene afbeeldingen
    if (selectedImages.length < count) {
      const remainingCount = count - selectedImages.length;
      const usedIndices = new Set(selectedIndices);
      const additionalImages: string[] = [];
      
      for (let i = 0; i < ALL_ACTIVITY_IMAGES.length && additionalImages.length < remainingCount; i++) {
        if (!usedIndices.has(i) && ALL_ACTIVITY_IMAGES[i] && typeof ALL_ACTIVITY_IMAGES[i] === 'string') {
          additionalImages.push(ALL_ACTIVITY_IMAGES[i]);
        }
      }
      
      selectedImages.push(...additionalImages.slice(0, remainingCount));
    }
    
    return {
      images: selectedImages,
      hasMatch: true
    };
  }
  
  // Geen match gevonden - gebruik alle afbeeldingen
  return {
    images: ALL_ACTIVITY_IMAGES.slice(0, count),
    hasMatch: false
  };
}

// Nieuwe functie die meerdere relevante afbeeldingen retourneert
export function getSmartImageAlternatives(title: string, description: string = "", count: number = 8): { 
  images: string[], 
  hasMatch: boolean,
  primaryImage: string | null 
} {
  const combinedText = `${title} ${description}`.toLowerCase();
  
  // Zoek naar keywords in de tekst
  const matchedImages: number[] = [];
  const keywordMatches: string[] = [];
  
  for (const [keyword, imageIndices] of Object.entries(KEYWORD_MAPPINGS)) {
    if (combinedText.includes(keyword)) {
      matchedImages.push(...imageIndices);
      keywordMatches.push(keyword);
    }
  }
  
  if (matchedImages.length > 0) {
    // Verwijder duplicaten en shuffle voor variatie
    const uniqueIndices: number[] = [];
    const seen = new Set<number>();
    for (const index of matchedImages) {
      if (!seen.has(index)) {
        seen.add(index);
        uniqueIndices.push(index);
      }
    }
    const shuffledIndices = uniqueIndices.sort(() => Math.random() - 0.5);
    
    // Selecteer de eerste als primaire afbeelding
    const primaryIndex = shuffledIndices[0];
    const primaryImage = ALL_ACTIVITY_IMAGES[primaryIndex];
    
    // Selecteer tot 'count' aantal afbeeldingen
    const selectedIndices = shuffledIndices.slice(0, Math.min(count, uniqueIndices.length));
    const selectedImages = selectedIndices
      .map(index => ALL_ACTIVITY_IMAGES[index])
      .filter(image => image && typeof image === 'string'); // Filter null/undefined waarden
    
    // Als we minder matches hebben dan gewenst, vul aan met gerelateerde afbeeldingen
    if (selectedImages.length < count) {
      const remainingCount = count - selectedImages.length;
      const usedIndices = new Set(selectedIndices);
      const additionalImages: string[] = [];
      
      // Voeg willekeurige afbeeldingen toe uit dezelfde categorie-groepen
      for (let i = 0; i < ALL_ACTIVITY_IMAGES.length && additionalImages.length < remainingCount; i++) {
        if (!usedIndices.has(i) && ALL_ACTIVITY_IMAGES[i] && typeof ALL_ACTIVITY_IMAGES[i] === 'string') {
          additionalImages.push(ALL_ACTIVITY_IMAGES[i]);
        }
      }
      
      selectedImages.push(...additionalImages.slice(0, remainingCount));
    }
    
    console.log(`Slimme selectie alternatieven voor "${title}": ${keywordMatches.join(', ')} -> ${selectedImages.length} afbeeldingen`);
    return { 
      images: selectedImages, 
      hasMatch: true, 
      primaryImage 
    };
  }
  
  // Geen match gevonden - gebruik eerste 8 algemene afbeeldingen als fallback
  const fallbackImages = ALL_ACTIVITY_IMAGES
    .slice(0, count)
    .filter(image => image && typeof image === 'string'); // Filter null/undefined waarden
  console.log(`Geen passende afbeelding gevonden voor "${title}" - gebruik fallback afbeeldingen`);
  return { 
    images: fallbackImages, 
    hasMatch: false, 
    primaryImage: null 
  };
}