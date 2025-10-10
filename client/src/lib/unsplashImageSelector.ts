// Unsplash API integratie voor dynamische foto selectie
// Met fallback naar lokale foto mapping

interface KeywordMapping {
  keywords: string[];
  photoIds: string[];
}

// Fallback foto mappings (gebruikt als API niet beschikbaar is)
const SPORT_KEYWORDS: KeywordMapping[] = [
  {
    keywords: ['basketbal', 'basket', '3x3', 'streetball', 'basketball'],
    photoIds: ['photo-1546519638-68e109498ffc', 'photo-1519861531473-9200e868bedb', 'photo-1504450758481-7338eba7524a']
  },
  {
    keywords: ['voetbal', 'soccer', 'football'],
    photoIds: ['photo-1575361204480-aadea25e6e68', 'photo-1431324155629-1a6deb1dec8d', 'photo-1540379708242-14a809b1e51c']
  },
  {
    keywords: ['pokemon', 'pokémon'],
    photoIds: ['photo-1613771404784-3a5686aa2be3', 'photo-1614926037384-4159c33e2d20', 'photo-1628968434441-d9c2941768db']
  },
];

const KUNST_CULTUUR_KEYWORDS: KeywordMapping[] = [
  {
    keywords: ['concert', 'muziek', 'music', 'band', 'jazz', 'live'],
    photoIds: ['photo-1501612780327-45045538702b', 'photo-1470229722913-7c0e2dbbafd3', 'photo-1514320291840-2e0a9bf2a9ae']
  },
];

const ALL_KEYWORD_MAPPINGS = [...SPORT_KEYWORDS, ...KUNST_CULTUUR_KEYWORDS];

const FALLBACK_PHOTO_IDS = [
  'photo-1492684223066-81342ee5ff30',
  'photo-1511578314322-379afb476865', 
  'photo-1505373877841-8d25f7d46678',
];

function photoIdToUrl(photoId: string): string {
  return `https://images.unsplash.com/${photoId}?q=80&w=1000`;
}

function extractKeywords(title: string): string[] {
  const lowerTitle = title.toLowerCase();
  const noiseWords = ['de', 'het', 'een', 'voor', 'van', 'met', 'en', 'of', 'op', 'in', 'bij', 'naar', 'aan', 'om'];
  
  return lowerTitle
    .split(/[\s\-_,.\(\)\[\]]+/)
    .filter(word => word.length > 2)
    .filter(word => !/^\d+x?\d*$/.test(word))
    .filter(word => !noiseWords.includes(word));
}

function findMatchingPhotoIds(title: string): string[] | null {
  const titleWords = extractKeywords(title);
  
  for (const mapping of ALL_KEYWORD_MAPPINGS) {
    for (const titleWord of titleWords) {
      if (mapping.keywords.some(k => k === titleWord || k.includes(titleWord) || titleWord.includes(k))) {
        return mapping.photoIds;
      }
    }
  }
  
  return null;
}

/**
 * Fallback functie: lokale foto mapping (gebruikt als API niet beschikbaar is)
 */
function getFallbackImages(title: string): string[] {
  const photoIds = findMatchingPhotoIds(title);
  
  if (photoIds && photoIds.length > 0) {
    const shuffled = [...photoIds].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3).map(photoIdToUrl);
  }
  
  return FALLBACK_PHOTO_IDS.map(photoIdToUrl);
}

/**
 * Hoofdfunctie: Haal foto's op via Unsplash API
 * Valt terug op lokale mapping als API niet beschikbaar is
 */
export async function getMatchingImages(title: string, category: string): Promise<string[]> {
  // Probeer eerst de Unsplash API
  try {
    const response = await fetch(`/api/unsplash/search?query=${encodeURIComponent(title)}&count=3`);
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.photos && data.photos.length > 0) {
        const urls = data.photos.map((photo: any) => photo.url);
        return urls;
      }
    }
  } catch (error) {
    console.warn('Unsplash API niet beschikbaar, gebruik fallback');
  }

  // Fallback naar lokale mapping
  return getFallbackImages(title);
}

/**
 * Generate single image URL
 */
export async function generateUnsplashImageUrl(title: string, category: string): Promise<string> {
  const images = await getMatchingImages(title, category);
  const randomIndex = Math.floor(Math.random() * images.length);
  return images[randomIndex];
}
