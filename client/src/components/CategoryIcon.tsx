import { Trophy, Palette, Users, GraduationCap, Heart } from 'lucide-react';
import { CATEGORIES } from '@shared/schema';

export const CATEGORY_COLORS = {
  'Sport en spel': '#3B82F6', // blue-500
  'Kunst en Cultuur': '#8B5CF6', // violet-500
  'Gezellig en Sociaal': '#22C55E', // green-500
  'Leren en Ontdekken': '#F97316', // orange-500
  'Vrijwilligerswerk en hulp': '#EF4444', // red-500
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