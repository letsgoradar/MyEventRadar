import nlp from 'compromise';
import numbers from 'compromise-numbers';
import { CATEGORIES } from '@shared/schema';
nlp.extend(numbers);

const EVENT_TEMPLATES = [
  "Een geweldig {category} evenement waar {description}",
  "Kom naar dit unieke {category} evenement! {description}",
  "Mis dit {category} niet - {description}",
  "Een bijzondere {category} ervaring: {description}",
];

// Uitgebreide woordenlijsten per categorie voor betere suggesties
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Tentoonstelling': [
    'tentoonstelling', 'expositie', 'galerie', 'museum', 'kunst', 'schilderij', 'vernissage',
    'kunstenaar', 'beeldhouw', 'fotografie', 'expo', 'collectie', 'design', 'installatie'
  ],
  'Voorstelling': [
    'concert', 'muziek', 'theater', 'toneel', 'musical', 'opera', 'ballet', 'dans',
    'cabaret', 'comedy', 'standup', 'film', 'bioscoop', 'optreden', 'voorstelling', 'show',
    'live', 'jazz', 'band', 'dj', 'koor', 'circus', 'acrobatiek', 'piano', 'gitaar'
  ],
  'Activiteit': [
    'sport', 'spel', 'toernooi', 'wedstrijd', 'marathon', 'race', 'tennis', 'voetbal',
    'hardlopen', 'zwemmen', 'fietsen', 'yoga', 'fitness', 'wandelen', 'speurtocht',
    'kinderfeest', 'kinderactiviteit', 'atletiek', 'basketbal', 'hockey', 'schaatsen'
  ],
  'Stappen & Borrel': [
    'borrel', 'feest', 'party', 'festival', 'kermis', 'carnaval', 'dancing', 'rave',
    'koningsdag', 'nieuwjaar', 'jubileum', 'verjaardag', 'stappen', 'uitgaan', 'netwerk',
    'happy hour', 'terras', 'cocktail', 'dansen', 'openlucht'
  ],
  'Markt & Beurs': [
    'markt', 'beurs', 'rommelmarkt', 'braderie', 'koopzondag', 'vlooienmarkt', 'kerstmarkt',
    'weekmarkt', 'boerenmarkt', 'fair', 'antiek', 'vintage', 'tweedehands', 'kraampjes'
  ],
  'Quiz & Spelletjes': [
    'pubquiz', 'quiz', 'bingo', 'bordspel', 'spelletjes', 'trivia', 'escape room',
    'puzzel', 'kaartspel', 'speeddaten', 'kienen', 'gameavond'
  ],
  'Leren & Ontdekken': [
    'lezing', 'workshop', 'cursus', 'leren', 'educatie', 'kennis', 'seminar', 'conferentie',
    'masterclass', 'training', 'presentatie', 'college', 'rondleiding', 'excursie',
    'meditatie', 'mindfulness', 'natuur', 'ontdekken', 'innovatie', 'technologie'
  ],
  'Eten & Drinken': [
    'foodfestival', 'proeverij', 'diner', 'culinair', 'restaurant', 'tasting', 'koken', 'bakken',
    'bbq', 'barbecue', 'food truck', 'streetfood', 'wijn', 'bier', 'brunch', 'lunch'
  ],
};

/**
 * Suggereert een categorie op basis van tekst (titel en/of beschrijving)
 * Gebruikt een uitgebreide woordenlijst en slimme scoring om een passende categorie te vinden
 */
export function suggestCategory(text: string): typeof CATEGORIES[number] | undefined {
  if (!text || text.trim() === '') return undefined;
  
  const textLower = text.toLowerCase();
  
  // Bereken scores voor elke categorie
  const scores = CATEGORIES.map(category => {
    const keywords = CATEGORY_KEYWORDS[category];
    let score = 0;
    
    // Tel exacte matches (hele woorden) dubbel
    for (const keyword of keywords) {
      // Check op exacte woord-grenzen met regex
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const exactMatches = (textLower.match(regex) || []).length;
      score += exactMatches * 2;
      
      // Gedeeltelijke matches tellen minder zwaar
      if (exactMatches === 0 && textLower.includes(keyword)) {
        score += 1;
      }
    }
    
    return { category, score };
  });
  
  // Sorteer op score en kies de hoogste
  scores.sort((a, b) => b.score - a.score);
  
  // Alleen een categorie teruggeven als er minstens 1 match is
  return scores[0].score > 0 ? scores[0].category : undefined;
}

export function generateTags(title: string, category: string): string[] {
  const doc = nlp(title.toLowerCase());

  // Extract nouns and verbs
  const nouns = doc.nouns().out('array');
  const verbs = doc.verbs().out('array');

  // Combine with category
  const baseTags = [...new Set([...nouns, ...verbs, category.toLowerCase()])];

  // Filter out common words and limit to 5 tags
  const commonWords = ['de', 'het', 'een', 'in', 'op', 'van'];
  return baseTags
    .filter(tag => !commonWords.includes(tag))
    .slice(0, 5)
    .map(tag => tag.trim());
}

export function generateDescription(data: {
  title: string;
  category: string;
  description?: string;
}): string {
  const template = EVENT_TEMPLATES[Math.floor(Math.random() * EVENT_TEMPLATES.length)];
  return template
    .replace('{category}', data.category.toLowerCase())
    .replace('{description}', data.description || `${data.title} presenteert`);
}