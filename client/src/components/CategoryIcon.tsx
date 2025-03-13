import { Trophy, Palette, Users, GraduationCap, Heart } from 'lucide-react';
import { CATEGORIES } from '@shared/schema';

export const CATEGORY_COLORS = {
  'Sport en spel': '#3B82F6', // blue-500
  'Kunst en Cultuur': '#8B5CF6', // violet-500
  'Gezellig en Sociaal': '#22C55E', // green-500
  'Leren en Ontdekken': '#F97316', // orange-500
  'Vrijwilligerswerk en hulp': '#EF4444', // red-500
} as const;

// SVG paths for the icons
export const CATEGORY_PATHS = {
  'Sport en spel': 'M7.05 3.691c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.372 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.539 1.118l-2.8-2.034a1 1 0 00-1.176 0l-2.8 2.034c-.783.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.363-1.118L.98 9.483c-.784-.57-.381-1.81.587-1.81H5.03a1 1 0 00.95-.69L7.05 3.69z',
  'Kunst en Cultuur': 'M12 6.207L14.181 3h-.905c.163-.41.317-.817.475-1.226.735-1.906-.055-3.279-1.095-3.279-.62 0-1.104.407-1.567.924C10.557.023 10.154.672 9.72 1.774h-.904l2.181 3.207L12 6.207zM5.659 12.417c-.089.204-.182.407-.272.615l8.169 8.668c.168.185.459.185.633 0L21.436 14c.174-.185.174-.479 0-.67l-8.167-8.67h-2.605l-1.143 1.668c-.196.293-.196.648 0 .945l1.143 1.668h1.605L15.228 12l-2.957 3.135H10.63L9.487 13.467c-.196-.297-.196-.652 0-.945l1.143-1.668h-2.604L.857 18.523c-.175.186-.175.482 0 .67l7.167 7.7c.174.186.459.186.633 0L16.89 18.33c.089-.208.182-.411.271-.615-.499-.303-.731-.732-.731-1.22 0-.482.246-.911.731-1.214l-6.271-6.699H8.286l-1.143 1.668c-.196.293-.196.648 0 .945l1.143 1.668h2.605l-5.957 6.334c-.175.186-.175.482 0 .67l5.167 5.5c.174.186.459.186.633 0l5.957-6.334h-2.605l-1.143-1.668c-.196-.297-.196-.652 0-.945l1.143-1.668h2.604l6.271 6.699c-.485.303-.731.732-.731 1.214 0 .488.232.917.731 1.22',
  'Gezellig en Sociaal': 'M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z',
  'Leren en Ontdekken': 'M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z M12 14l-6-3.2V2l6 3.2V14z M12 14l6-3.2V2l-6 3.2V14z',
  'Vrijwilligerswerk en hulp': 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
} as const;

export const CATEGORY_ICONS = {
  'Sport en spel': Trophy,
  'Kunst en Cultuur': Palette,
  'Gezellig en Sociaal': Users,
  'Leren en Ontdekken': GraduationCap,
  'Vrijwilligerswerk en hulp': Heart,
} as const;

interface CategoryIconProps {
  category: typeof CATEGORIES[number];
  className?: string;
  size?: number;
}

export function CategoryIcon({ category, className = "", size = 20 }: CategoryIconProps) {
  const Icon = CATEGORY_ICONS[category];
  return (
    <Icon
      size={size}
      className={`${className}`}
      style={{ color: CATEGORY_COLORS[category] }}
    />
  );
}

export function getCategoryColor(category: typeof CATEGORIES[number] | undefined): string {
  if (!category) return '#94A3B8'; // gray-400 for unknown categories
  return CATEGORY_COLORS[category];
}