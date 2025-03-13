import nlp from 'compromise';
import numbers from 'compromise-numbers';
nlp.extend(numbers);

const EVENT_TEMPLATES = [
  "Een geweldig {category} evenement waar {description}",
  "Kom naar dit unieke {category} evenement! {description}",
  "Mis dit {category} niet - {description}",
  "Een bijzondere {category} ervaring: {description}",
];

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
  subcategory?: string;
  description?: string;
}): string {
  const template = EVENT_TEMPLATES[Math.floor(Math.random() * EVENT_TEMPLATES.length)];
  return template
    .replace('{category}', data.category.toLowerCase())
    .replace('{description}', data.description || `${data.title} presenteert`);
}
