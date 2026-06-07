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
    'beeldhouw', 'fotografie', 'expo', 'collectie', 'design', 'installatie', 'erfgoed',
    'kunstenaar', 'atelier'
  ],
  'Muziek & Concert': [
    'concert', 'muziek', 'livemuziek', 'optreden', 'band', 'orkest', 'koor', 'zang',
    'dj', 'jazz', 'klassiek', 'pop', 'rock', 'piano', 'gitaar', 'akoestisch'
  ],
  'Theater, Dans & Film': [
    'theater', 'toneel', 'musical', 'opera', 'ballet', 'dans', 'cabaret', 'comedy',
    'standup', 'film', 'cinema', 'bioscoop', 'voorstelling', 'show', 'circus', 'performance'
  ],
  'Sport & Bewegen': [
    'sport', 'wedstrijd', 'toernooi', 'marathon', 'hardlopen', 'voetbal', 'tennis',
    'basketbal', 'zwemmen', 'fitness', 'yoga', 'atletiek', 'gym', 'vechtsport',
    'schaatsen', 'bootcamp'
  ],
  'Wandelen, Fietsen & Natuur': [
    'wandelen', 'wandeling', 'fietsen', 'wielrennen', 'route', 'natuur', 'speurtocht',
    'park', 'tuin', 'outdoor', 'fietstocht', 'boswandeling'
  ],
  'Rondleiding & Uitstap': [
    'rondleiding', 'excursie', 'tour', 'uitstap', 'opendeur', 'opendeurdag', 'open dag',
    'bezoek', 'daguitstap', 'dagje uit'
  ],
  'Cursus & Workshop': [
    'cursus', 'workshop', 'training', 'les', 'lessenreeks', 'masterclass', 'creatief',
    'knutsel', 'handwerk', 'schilderen', 'atelier', 'leren'
  ],
  'Lezing & Congres': [
    'lezing', 'congres', 'seminar', 'symposium', 'presentatie', 'conferentie', 'college',
    'debat', 'talk', 'boekpresentatie'
  ],
  'Markt & Beurs': [
    'markt', 'braderie', 'rommelmarkt', 'vlooienmarkt', 'kerstmarkt', 'weekmarkt',
    'boerenmarkt', 'beurs', 'fair', 'antiek', 'vintage', 'tweedehands'
  ],
  'Eten & Drinken': [
    'eten', 'food', 'foodfestival', 'proeverij', 'diner', 'culinair', 'restaurant',
    'tasting', 'koken', 'bakken', 'bbq', 'barbecue', 'wijn', 'bier', 'streetfood', 'brunch'
  ],
  'Quiz & Spelletjes': [
    'quiz', 'pubquiz', 'bingo', 'bordspel', 'spelletjes', 'trivia', 'escape room',
    'kienen', 'gameavond', 'kaartspel'
  ],
  'Familie & Vakantie': [
    'familie', 'kinderen', 'kids', 'kinderfeest', 'kinderactiviteit', 'jeugd', 'kamp',
    'vakantie', 'speeltuin', 'gezin', 'peuter'
  ],
  'Feest & Nachtleven': [
    'feest', 'party', 'borrel', 'kermis', 'carnaval', 'festival', 'fuif', 'dancing',
    'rave', 'uitgaan', 'stappen', 'terras', 'cocktail', 'dansen'
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