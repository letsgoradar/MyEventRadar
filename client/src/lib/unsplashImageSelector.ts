// Automatische Unsplash foto selectie op basis van event titel en categorie
// Gebruikt specifieke, geverifieerde Unsplash foto URLs voor accurate resultaten

interface UnsplashImage {
  id: string;
  keywords: string[];
}

// Specifieke Unsplash foto's per activiteit categorie
const SPORT_IMAGES: Record<string, UnsplashImage[]> = {
  basketbal: [
    { id: 'JOT8cfMhQGk', keywords: ['basketball', 'basketbal', '3x3', 'streetball'] },
    { id: 'ngMtsE5r9eI', keywords: ['basketball', 'basketbal', 'sport'] },
    { id: 'cpIgNaazQ6w', keywords: ['basketball', 'basketbal', 'outdoor'] },
  ],
  voetbal: [
    { id: 'Mwuod2cm8g4', keywords: ['football', 'voetbal', 'soccer'] },
    { id: 'rChFUMwAe7E', keywords: ['football', 'voetbal', 'field'] },
    { id: '4x_dRfH8M_I', keywords: ['football', 'voetbal', 'team'] },
  ],
  hardlopen: [
    { id: 'lqoWnglOxvg', keywords: ['running', 'hardlopen', 'jogging', 'marathon'] },
    { id: 'WvDYdXDzkhs', keywords: ['running', 'hardlopen', 'trail'] },
    { id: 'ymf4_9Y9S_A', keywords: ['running', 'hardlopen', 'park'] },
  ],
  fietsen: [
    { id: 'phIFdC6lA4E', keywords: ['cycling', 'fietsen', 'wielrennen', 'bike'] },
    { id: 'XEe36YnKfDs', keywords: ['cycling', 'fietsen', 'mountain'] },
    { id: '7Sz6GTjIHWQ', keywords: ['cycling', 'fietsen', 'road'] },
  ],
  zwemmen: [
    { id: 'FO7bKvgETgQ', keywords: ['swimming', 'zwemmen', 'pool'] },
    { id: '7B9vSUMhHrw', keywords: ['swimming', 'zwemmen', 'water'] },
    { id: 'eBRTYyjwpRY', keywords: ['swimming', 'zwemmen', 'outdoor'] },
  ],
  tennis: [
    { id: 'oD9S1uKU8k8', keywords: ['tennis', 'racket', 'court'] },
    { id: 'h4i9G-de7Po', keywords: ['tennis', 'sport', 'game'] },
    { id: 'SxAXphIPWeg', keywords: ['tennis', 'match', 'play'] },
  ],
  yoga: [
    { id: 'gJtDg6WfMlQ', keywords: ['yoga', 'meditation', 'wellness'] },
    { id: 'g0rYBJ7kmp4', keywords: ['yoga', 'pose', 'stretching'] },
    { id: 'klWqMO7Q6cE', keywords: ['yoga', 'outdoor', 'nature'] },
  ],
  fitness: [
    { id: 'WvDYdXDzkhs', keywords: ['fitness', 'gym', 'workout', 'training', 'bootcamp'] },
    { id: 'CQfNt66ttZM', keywords: ['fitness', 'strength', 'exercise'] },
    { id: 'IqAEjUj97KU', keywords: ['fitness', 'cardio', 'training'] },
  ],
  wandelen: [
    { id: 'TdeazFYE5c4', keywords: ['hiking', 'wandelen', 'nature', 'trail'] },
    { id: 'eOpewngf68w', keywords: ['hiking', 'wandelen', 'mountain'] },
    { id: '5HFm96vCKTM', keywords: ['hiking', 'wandelen', 'forest'] },
  ],
  golf: [
    { id: 'tmRuRPBiPzQ', keywords: ['golf', 'course', 'green'] },
    { id: 'P-_Ah2h-yno', keywords: ['golf', 'swing', 'sport'] },
    { id: 'IAvKiRBqMeI', keywords: ['golf', 'game', 'outdoor'] },
  ],
  schaken: [
    { id: 'gqD0uz60iOU', keywords: ['chess', 'schaken', 'strategy', 'game'] },
    { id: 'l5_YiMS_3dg', keywords: ['chess', 'schaken', 'tournament'] },
    { id: 'USBGPz_T8P4', keywords: ['chess', 'schaken', 'board'] },
  ],
};

const KUNST_CULTUUR_IMAGES: Record<string, UnsplashImage[]> = {
  concert: [
    { id: 'Yvp-PW1k7RQ', keywords: ['concert', 'music', 'live', 'show'] },
    { id: 'hzgs56Ze49s', keywords: ['concert', 'stage', 'performance'] },
    { id: '1NTFSnV-KLs', keywords: ['concert', 'audience', 'event'] },
  ],
  jazz: [
    { id: 'cdwP-IqkHhQ', keywords: ['jazz', 'music', 'saxophone'] },
    { id: 'w0wpzkGFKGU', keywords: ['jazz', 'band', 'performance'] },
    { id: 'RQgKM1h2agI', keywords: ['jazz', 'piano', 'live'] },
  ],
  schilderen: [
    { id: 'HRZUzoX1e6w', keywords: ['painting', 'schilderen', 'art', 'workshop'] },
    { id: 'pnXBYTvSYiY', keywords: ['painting', 'schilderen', 'creative'] },
    { id: 'ulK64dHpKUQ', keywords: ['painting', 'schilderen', 'canvas'] },
  ],
  fotografie: [
    { id: 'ywqa9IZB-dU', keywords: ['photography', 'fotografie', 'camera'] },
    { id: 'W_K6j6OQBDg', keywords: ['photography', 'fotografie', 'workshop'] },
    { id: '_1zqCYL3lNw', keywords: ['photography', 'fotografie', 'nature'] },
  ],
  theater: [
    { id: 'TlBF3ZUVTvE', keywords: ['theater', 'performance', 'stage', 'show'] },
    { id: '4Op9_scOkSY', keywords: ['theater', 'drama', 'acting'] },
    { id: 'AtPWnYNDJnM', keywords: ['theater', 'audience', 'play'] },
  ],
  film: [
    { id: 'aHxN3KJu_7A', keywords: ['cinema', 'film', 'movie', 'screening'] },
    { id: 'tV_1sC603zA', keywords: ['cinema', 'film', 'theater'] },
    { id: '7SjEuEF06Zk', keywords: ['cinema', 'film', 'popcorn'] },
  ],
  koken: [
    { id: 'IGfIGP5ONV0', keywords: ['cooking', 'koken', 'workshop', 'chef'] },
    { id: 'lP5MCM6nZ5A', keywords: ['cooking', 'koken', 'class'] },
    { id: '0mrztyJ2rS8', keywords: ['cooking', 'koken', 'food'] },
  ],
};

const GEZELLIG_SOCIAAL_IMAGES: Record<string, UnsplashImage[]> = {
  barbecue: [
    { id: 'VWcPlbHglYc', keywords: ['barbecue', 'bbq', 'grill', 'outdoor'] },
    { id: 'yU5tyNI01t8', keywords: ['barbecue', 'bbq', 'social'] },
    { id: 'qom5MPOER-I', keywords: ['barbecue', 'bbq', 'food'] },
  ],
  bordspellen: [
    { id: 'dDO_pA5hGWk', keywords: ['board games', 'bordspellen', 'spelletjes', 'game'] },
    { id: 'TrhLCn1abMU', keywords: ['board games', 'bordspellen', 'play'] },
    { id: 's8F8yglbpjo', keywords: ['board games', 'bordspellen', 'fun'] },
  ],
  koffie: [
    { id: 'L-sm1B4L1Ns', keywords: ['coffee', 'koffie', 'meeting', 'social'] },
    { id: 'Y_LgXwQEx2c', keywords: ['coffee', 'koffie', 'cafe'] },
    { id: 'Ws4wd-vJ9M0', keywords: ['coffee', 'koffie', 'friends'] },
  ],
  picknick: [
    { id: 'BhJTrJP03Ck', keywords: ['picnic', 'picknick', 'outdoor', 'park'] },
    { id: 'cX5RZ8ZRkS8', keywords: ['picnic', 'picknick', 'food'] },
    { id: 'AXmlHntUj1s', keywords: ['picnic', 'picknick', 'nature'] },
  ],
  wijn: [
    { id: 'tkfRSPt-jdk', keywords: ['wine', 'wijn', 'tasting', 'proeven'] },
    { id: 'cXkrJdDeaS8', keywords: ['wine', 'wijn', 'glass'] },
    { id: 'bKhETeDV1WM', keywords: ['wine', 'wijn', 'social'] },
  ],
  quiz: [
    { id: 's8F8yglbpjo', keywords: ['quiz', 'pubquiz', 'trivia', 'game'] },
    { id: 'vpHCfunwDrQ', keywords: ['quiz', 'pubquiz', 'pub'] },
    { id: 'kJrV_vz6ggw', keywords: ['quiz', 'pubquiz', 'social'] },
  ],
  brunch: [
    { id: 'IGfIGP5ONV0', keywords: ['brunch', 'breakfast', 'food', 'social'] },
    { id: 'vqDAUejnwKw', keywords: ['brunch', 'meal', 'dining'] },
    { id: 'z3QZ6gjGRt4', keywords: ['brunch', 'friends', 'restaurant'] },
  ],
};

const LEREN_ONTDEKKEN_IMAGES: Record<string, UnsplashImage[]> = {
  programmeren: [
    { id: '4Mw7nkQDByk', keywords: ['coding', 'programmeren', 'programming', 'developer'] },
    { id: 'npxXWgQ33ZQ', keywords: ['coding', 'programmeren', 'computer'] },
    { id: 'lUbIun4IL38', keywords: ['coding', 'programmeren', 'tech'] },
  ],
  natuur: [
    { id: 'eOpewngf68w', keywords: ['nature', 'natuur', 'outdoor', 'wandeling'] },
    { id: 'TdeazFYE5c4', keywords: ['nature', 'natuur', 'forest'] },
    { id: 'MP0IUfwrn0A', keywords: ['nature', 'natuur', 'landscape'] },
  ],
  workshop: [
    { id: 'HRZUzoX1e6w', keywords: ['workshop', 'learning', 'hands-on'] },
    { id: 'lP5MCM6nZ5A', keywords: ['workshop', 'class', 'education'] },
    { id: 'pnXBYTvSYiY', keywords: ['workshop', 'creative', 'art'] },
  ],
  lezing: [
    { id: '2FaCKyEEtis', keywords: ['lecture', 'lezing', 'presentation', 'talk'] },
    { id: 'WE_Kv_ZB1l0', keywords: ['lecture', 'lezing', 'audience'] },
    { id: 'LrMWHKqilUw', keywords: ['lecture', 'lezing', 'education'] },
  ],
  vogels: [
    { id: 'U_fHbhYVe1g', keywords: ['bird watching', 'vogels', 'nature', 'birding'] },
    { id: 'GNyjCePVRs8', keywords: ['bird watching', 'vogels', 'wildlife'] },
    { id: 'rCbdp8VCYhQ', keywords: ['bird watching', 'vogels', 'outdoor'] },
  ],
};

const VRIJWILLIGERS_IMAGES: Record<string, UnsplashImage[]> = {
  opruimen: [
    { id: 'yXwGNkfMWvY', keywords: ['cleanup', 'opruimen', 'environment', 'volunteer'] },
    { id: 'lNu6U5jmny0', keywords: ['cleanup', 'opruimen', 'nature'] },
    { id: 'kxRsHGrHPRs', keywords: ['cleanup', 'opruimen', 'community'] },
  ],
  voedselbank: [
    { id: 'IVR2-8wIPkQ', keywords: ['food bank', 'voedselbank', 'volunteer', 'charity'] },
    { id: '2oPm-free-oI', keywords: ['food bank', 'voedselbank', 'helping'] },
    { id: 'nJ7rvWzZlqA', keywords: ['food bank', 'voedselbank', 'community'] },
  ],
  planten: [
    { id: 'wcO2pw0XH4g', keywords: ['planting', 'planten', 'bomen', 'trees', 'environment'] },
    { id: 'VviFtDJakYk', keywords: ['planting', 'planten', 'garden'] },
    { id: 'JuFcQxgCXwA', keywords: ['planting', 'planten', 'nature'] },
  ],
  taal: [
    { id: 'Wpnoqo2plFA', keywords: ['language', 'taal', 'learning', 'education'] },
    { id: 'SWkzNQvUTWk', keywords: ['language', 'taal', 'teaching'] },
    { id: 'nShLC-WruxQ', keywords: ['language', 'taal', 'study'] },
  ],
  dieren: [
    { id: 'qRJKPhPkcq0', keywords: ['animal shelter', 'dieren', 'animals', 'volunteer'] },
    { id: 'IbPxGLgJiMI', keywords: ['animal shelter', 'dieren', 'care'] },
    { id: 'YiISRcq1A8c', keywords: ['animal shelter', 'dieren', 'pets'] },
  ],
};

// Combineer alle images
const ALL_IMAGES = {
  ...SPORT_IMAGES,
  ...KUNST_CULTUUR_IMAGES,
  ...GEZELLIG_SOCIAAL_IMAGES,
  ...LEREN_ONTDEKKEN_IMAGES,
  ...VRIJWILLIGERS_IMAGES,
};

// Fallback images per categorie
const CATEGORY_FALLBACKS: Record<string, string[]> = {
  'Sport en spel': ['JOT8cfMhQGk', 'WvDYdXDzkhs', 'lqoWnglOxvg'],
  'Kunst en Cultuur': ['Yvp-PW1k7RQ', 'HRZUzoX1e6w', 'ywqa9IZB-dU'],
  'Gezellig en Sociaal': ['VWcPlbHglYc', 'L-sm1B4L1Ns', 'BhJTrJP03Ck'],
  'Leren en Ontdekken': ['4Mw7nkQDByk', 'eOpewngf68w', '2FaCKyEEtis'],
  'Vrijwilligerswerk en hulp': ['yXwGNkfMWvY', 'wcO2pw0XH4g', 'IVR2-8wIPkQ'],
};

/**
 * Extract keywords from event title
 * Removes numbers, special characters, and common words
 */
function extractKeywords(title: string): string[] {
  const lowerTitle = title.toLowerCase();
  
  // Remove common noise words
  const noiseWords = ['de', 'het', 'een', 'voor', 'van', 'met', 'en', 'of', 'op', 'in', 'bij', 'naar', 'aan'];
  
  // Split on spaces and special characters, remove numbers and noise words
  const words = lowerTitle
    .split(/[\s\-_,.\(\)\[\]]+/)
    .filter(word => word.length > 2)
    .filter(word => !/^\d+x?\d*$/.test(word)) // Remove pure numbers like "3", "3x3"
    .filter(word => !noiseWords.includes(word));
  
  return words;
}

/**
 * Find the best matching images for the event
 */
function findMatchingImages(title: string, category: string): string[] {
  const keywords = extractKeywords(title);
  
  // Try to find exact matches
  for (const keyword of keywords) {
    if (ALL_IMAGES[keyword]) {
      const images = ALL_IMAGES[keyword];
      return images.map(img => `https://images.unsplash.com/${img.id}?w=800&h=600&fit=crop`);
    }
  }
  
  // Try partial matches
  for (const [key, images] of Object.entries(ALL_IMAGES)) {
    for (const keyword of keywords) {
      if (key.includes(keyword) || keyword.includes(key)) {
        return images.map(img => `https://images.unsplash.com/${img.id}?w=800&h=600&fit=crop`);
      }
    }
  }
  
  // Try matching against image keywords
  for (const [key, images] of Object.entries(ALL_IMAGES)) {
    for (const image of images) {
      for (const imageKeyword of image.keywords) {
        for (const titleKeyword of keywords) {
          if (imageKeyword.toLowerCase().includes(titleKeyword) || titleKeyword.includes(imageKeyword.toLowerCase())) {
            return images.map(img => `https://images.unsplash.com/${img.id}?w=800&h=600&fit=crop`);
          }
        }
      }
    }
  }
  
  // Use category fallbacks
  const fallbackIds = CATEGORY_FALLBACKS[category] || CATEGORY_FALLBACKS['Gezellig en Sociaal'];
  return fallbackIds.map(id => `https://images.unsplash.com/${id}?w=800&h=600&fit=crop`);
}

/**
 * Genereer een Unsplash foto URL op basis van event titel en categorie
 * @param title - Event titel
 * @param category - Event categorie
 * @returns Unsplash foto URL
 */
export function generateUnsplashImageUrl(title: string, category: string): string {
  const matchingImages = findMatchingImages(title, category);
  
  // Return a random image from the matching set
  const randomIndex = Math.floor(Math.random() * matchingImages.length);
  return matchingImages[randomIndex];
}

/**
 * Get all matching images for variety
 */
export function getMatchingImages(title: string, category: string): string[] {
  return findMatchingImages(title, category);
}

/**
 * Test functie om te zien welke foto voor een event wordt geselecteerd
 */
export function previewUnsplashImage(title: string, category: string): void {
  const keywords = extractKeywords(title);
  const images = findMatchingImages(title, category);
  console.log(`Event: "${title}" (${category})`);
  console.log(`Extracted keywords: ${keywords.join(', ')}`);
  console.log(`Matching images: ${images.length}`);
  console.log(`First image URL: ${images[0]}`);
}
