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
  'Sport en spel': 'M14.1 7.75l-.79-2.44a.5.5 0 01.48-.65h2.68a.5.5 0 01.29.91L14.1 7.75zm-.85-2.97L12.5 2.5l-.75 2.28a.5.5 0 01-.48.34H8.59a.5.5 0 00-.29.91l2.66 1.93a.5.5 0 01.18.56l-1.02 3.13a.5.5 0 00.77.56l2.71-1.97a.5.5 0 01.59 0l2.71 1.97a.5.5 0 00.77-.56l-1.02-3.13a.5.5 0 01.18-.56l2.66-1.93a.5.5 0 00-.29-.91h-2.68a.5.5 0 01-.48-.34L12.5 2.5z',
  'Kunst en Cultuur': 'M12 4.5v15m7.5-7.5h-15',
  'Gezellig en Sociaal': 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  'Leren en Ontdekken': 'M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5',
  'Vrijwilligerswerk en hulp': 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z'
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