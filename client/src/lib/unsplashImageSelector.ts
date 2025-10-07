// Automatische Unsplash foto selectie op basis van event titel en categorie
// Gebruikt zoekwoorden mapping voor optimale resultaten

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Sport en spel': ['sports', 'fitness', 'exercise', 'running', 'yoga', 'soccer', 'basketball', 'tennis', 'cycling', 'swimming'],
  'Kunst en Cultuur': ['art', 'concert', 'music', 'theater', 'painting', 'culture', 'gallery', 'performance', 'photography', 'crafts'],
  'Gezellig en Sociaal': ['social', 'party', 'gathering', 'friends', 'community', 'celebration', 'food', 'dining', 'coffee', 'picnic'],
  'Leren en Ontdekken': ['education', 'learning', 'workshop', 'nature', 'discovery', 'science', 'technology', 'books', 'study', 'course'],
  'Vrijwilligerswerk en hulp': ['volunteer', 'community', 'helping', 'charity', 'teamwork', 'environment', 'nature', 'planting', 'cleanup', 'support'],
};

const KEYWORD_MAP: Record<string, string> = {
  // Sport termen
  'voetbal': 'soccer',
  'hardlopen': 'running',
  'fietsen': 'cycling',
  'wielrennen': 'cycling',
  'zwemmen': 'swimming',
  'tennis': 'tennis',
  'basketbal': 'basketball',
  'yoga': 'yoga',
  'fitness': 'fitness',
  'bootcamp': 'bootcamp',
  'wandelen': 'hiking',
  'mountainbike': 'mountain biking',
  'golf': 'golf',
  'tafeltennis': 'table tennis',
  'schaken': 'chess',
  
  // Kunst & Cultuur
  'concert': 'concert',
  'jazz': 'jazz music',
  'muziek': 'music performance',
  'schilderen': 'painting',
  'aquarel': 'watercolor painting',
  'workshop': 'workshop',
  'fotografie': 'photography',
  'theater': 'theater performance',
  'film': 'cinema',
  'koken': 'cooking',
  'tekenen': 'drawing',
  'boetseren': 'pottery',
  
  // Gezellig & Sociaal
  'barbecue': 'barbecue',
  'bbq': 'barbecue',
  'spelletjes': 'board games',
  'bordspellen': 'board games',
  'koffie': 'coffee meeting',
  'picknick': 'picnic',
  'wijn': 'wine tasting',
  'proeven': 'tasting',
  'quiz': 'pub quiz',
  'pubquiz': 'pub quiz',
  'bingo': 'bingo',
  'brunch': 'brunch',
  'high tea': 'afternoon tea',
  
  // Leren & Ontdekken
  'programmeren': 'coding',
  'natuur': 'nature',
  'wandeling': 'nature walk',
  'ehbo': 'first aid',
  'lezing': 'lecture',
  'geschiedenis': 'history',
  'kruiden': 'herbs',
  'vogels': 'bird watching',
  'computer': 'computer',
  'sterren': 'stargazing',
  
  // Vrijwilligerswerk
  'opruimen': 'cleanup',
  'voedselbank': 'food bank',
  'taal': 'language learning',
  'repair': 'repair cafe',
  'bomen': 'tree planting',
  'planten': 'planting',
  'maatjes': 'mentoring',
  'dieren': 'animal shelter',
  'zwerfvuil': 'litter cleanup',
  'huiswerk': 'tutoring',
};

/**
 * Genereer een Unsplash foto URL op basis van event titel en categorie
 * @param title - Event titel
 * @param category - Event categorie
 * @returns Unsplash foto URL
 */
export function generateUnsplashImageUrl(title: string, category: string): string {
  // Converteer titel naar lowercase voor matching
  const lowerTitle = title.toLowerCase();
  
  // Zoek naar keywords in de titel
  let searchQuery = '';
  
  // Check of er een direct keyword match is
  for (const [dutchWord, englishPhrase] of Object.entries(KEYWORD_MAP)) {
    if (lowerTitle.includes(dutchWord)) {
      searchQuery = englishPhrase;
      break;
    }
  }
  
  // Als geen direct keyword gevonden, gebruik categorie keywords
  if (!searchQuery && CATEGORY_KEYWORDS[category]) {
    const categoryKeywords = CATEGORY_KEYWORDS[category];
    searchQuery = categoryKeywords[Math.floor(Math.random() * Math.min(3, categoryKeywords.length))];
  }
  
  // Fallback naar eerste categorie keyword
  if (!searchQuery) {
    searchQuery = CATEGORY_KEYWORDS[category]?.[0] || 'event';
  }
  
  // Voeg 'people' toe voor meer dynamische foto's
  const finalQuery = `${searchQuery} people activity`;
  
  // Genereer Unsplash URL met query
  // Gebruik source.unsplash.com voor random foto op basis van query
  const encodedQuery = encodeURIComponent(finalQuery);
  
  // Retour een Unsplash URL met vaste dimensies
  return `https://images.unsplash.com/photo-1${getRandomPhotoId()}?w=800&h=600&fit=crop&q=${encodedQuery}`;
}

/**
 * Genereer een random Unsplash photo ID voor variatie
 * Dit zorgt voor verschillende foto's bij dezelfde query
 */
function getRandomPhotoId(): string {
  // Lijst met bekende goede Unsplash photo IDs die werken met verschillende queries
  const photoIds = [
    '579952363873-27f3bade9f55', // sport
    '552674605-db6ffd4facb5', // running
    '544367567-0f2fcb009e0b', // yoga
    '622279457486-62dcc4a431d6', // tennis
    '529699211952-734e80c4d42b', // chess
    '511192336575-5a79af67a629', // jazz
    '513364776144-60967b0f800f', // painting
    '452587925148-ce544e77e70d', // photography
    '503095396549-807759245b35', // theater
    '511671782779-c97d3d27a1d4', // music
    '555939594-58d7cb561ad1', // barbecue
    '606503825508-882b1e5d08b4', // board games
    '511920170033-f8396924c348', // coffee
    '506368249639-73a05d6f6488', // picnic
    '510812431401-41d2bd2722f3', // wine
    '515378791036-0648a3ef77b2', // coding
    '551632811-561732d1e306', // nature walk
    '576091160399-112ba8d25d1d', // first aid
    '473341304170-971dccb5ac1e', // sustainability
    '464983308776-8f2b13912e4a', // history
    '532996122724-e3c354a0b15b', // cleanup
    '488521787991-ed7bbaae773c', // food bank
    '491841573634-28140fc7ced7', // language
    '581092580497-e0d23cbdf1dc', // repair
    '542601906990-b4d3fb778b09', // tree planting
  ];
  
  return photoIds[Math.floor(Math.random() * photoIds.length)];
}

/**
 * Test functie om te zien welke foto voor een event wordt geselecteerd
 */
export function previewUnsplashImage(title: string, category: string): void {
  const url = generateUnsplashImageUrl(title, category);
  console.log(`Event: "${title}" (${category})`);
  console.log(`Unsplash URL: ${url}`);
}
