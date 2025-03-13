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

// Category keywords mapping
const CATEGORY_KEYWORDS = {
  'Sport en spel': ['sport', 'spel', 'voetbal', 'tennis', 'game', 'gaming', 'spelen', 'wedstrijd', 'competitie', 'toernooi'],
  'Kunst en Cultuur': ['kunst', 'cultuur', 'museum', 'theater', 'film', 'muziek', 'dans', 'expositie', 'tentoonstelling', 'concert'],
  'Gezellig en Sociaal': ['borrel', 'feest', 'festival', 'meetup', 'sociaal', 'gezellig', 'samen', 'ontmoeting', 'netwerk'],
  'Leren en Ontdekken': ['workshop', 'lezing', 'cursus', 'training', 'seminar', 'leren', 'ontdekken', 'kennis', 'ontwikkeling'],
  'Vrijwilligerswerk en hulp': ['vrijwilliger', 'hulp', 'ondersteuning', 'charity', 'goed doel', 'gemeenschap', 'helpen']
};

export function suggestCategory(title: string): typeof CATEGORIES[number] | undefined {
  const titleLower = title.toLowerCase();

  // Find the category with the most matching keywords
  const matchCounts = Object.entries(CATEGORY_KEYWORDS).map(([category, keywords]) => ({
    category: category as typeof CATEGORIES[number],
    matches: keywords.filter(keyword => titleLower.includes(keyword)).length
  }));

  const bestMatch = matchCounts.reduce((prev, current) => 
    current.matches > prev.matches ? current : prev
  );

  return bestMatch.matches > 0 ? bestMatch.category : undefined;
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