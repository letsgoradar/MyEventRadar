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
const CATEGORY_KEYWORDS = {
  'Sport en spel': [
    'sport', 'spel', 'toernooi', 'wedstrijd', 'marathon', 'race', 'tennis', 'voetbal', 
    'hardlopen', 'zwemmen', 'fietsen', 'yoga', 'fitness', 'wandelen', 'gymnastiek', 
    'schaak', 'dammen', 'bordspel', 'kaartspel', 'game', 'gaming', 'esports', 'clinic',
    'training', 'competitie', 'match', 'atletiek', 'volleybal', 'basketbal', 'hockey'
  ],
  'Kunst en Cultuur': [
    'kunst', 'muziek', 'theater', 'concert', 'voorstelling', 'expositie', 'museum', 'cultuur',
    'film', 'bioscoop', 'tentoonstelling', 'schilderen', 'dans', 'ballet', 'opera', 'toneel',
    'festival', 'literatuur', 'poëzie', 'fotografie', 'creatief', 'tekenen', 'kunstenaar',
    'gitaar', 'piano', 'band', 'galerie', 'cultureel', 'boeken', 'schrijver', 'literair'
  ],
  'Gezellig en Sociaal': [
    'borrel', 'feest', 'sociaal', 'ontmoeting', 'meeting', 'netwerken', 'café', 'pub',
    'drinken', 'uitgaan', 'cocktail', 'receptie', 'bijeenkomst', 'samenzijn', 'barbecue', 'bbq',
    'diner', 'lunch', 'brunch', 'tasting', 'proeverij', 'gezellig', 'vrienden', 'netwerk',
    'bier', 'wijn', 'happy hour', 'café', 'terras', 'avond', 'samen', 'dating', 'ontmoet'
  ],
  'Leren en Ontdekken': [
    'lezing', 'workshop', 'cursus', 'leren', 'educatie', 'kennis', 'seminar', 'conferentie',
    'masterclass', 'studie', 'training', 'ontwikkeling', 'webinar', 'presentatie', 'college',
    'informatief', 'educatief', 'technologie', 'wetenschap', 'meetup', 'tech', 'boek',
    'innovatie', 'onderzoek', 'data', 'taal', 'geschiedenis', 'ontdekken', 'skills', 'vaardigheid'
  ],
  'Vrijwilligerswerk en hulp': [
    'vrijwilliger', 'hulp', 'inzameling', 'actie', 'donatie', 'ondersteuning', 'bijdragen',
    'helpen', 'liefdadigheid', 'goed doel', 'collecte', 'goededoel', 'gemeenschap', 'bijstand',
    'sociaal werk', 'maatschappelijk', 'assistentie', 'zorg', 'ouderen', 'milieu', 'natuur',
    'schoonmaak', 'buurt', 'samenleving', 'gemeenschap', 'voedselbank', 'hulpbehoevend', 'samen'
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