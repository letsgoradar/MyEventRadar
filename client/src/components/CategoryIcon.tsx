import { Frame, Mic2, Bike, PartyPopper, ShoppingBag, Gamepad2, BookOpen, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { CATEGORIES } from '@shared/schema';

export const CATEGORY_COLORS: Record<string, string> = {
  'Tentoonstelling':   '#8B5CF6',
  'Voorstelling':      '#EC4899',
  'Activiteit':        '#3B82F6',
  'Stappen & Borrel':  '#F97316',
  'Markt & Beurs':     '#F59E0B',
  'Quiz & Spelletjes': '#14B8A6',
  'Leren & Ontdekken': '#22C55E',
  'Eten & Drinken':    '#EF4444',
};

export const CATEGORY_PATHS: Record<string, string> = {
  'Tentoonstelling':   'M4 4h16v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm0 0l4 8m8-8l-4 8m-4 0h8',
  'Voorstelling':      'M12 2a3 3 0 100 6 3 3 0 000-6zm-7 9h14M5 21l2-4h10l2 4M12 11v4',
  'Activiteit':        'M12 2a10 10 0 110 20A10 10 0 0112 2zM6.5 8.5c0 1.5 2 4 5.5 4s5.5-2.5 5.5-4M12 12v5',
  'Stappen & Borrel':  'M5.8 11.3a7 7 0 0112.4 0M12 8v1M8 10l-1.5 1M16 10l1.5 1M9 18h6M10 15l-1 3M14 15l1 3',
  'Markt & Beurs':     'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
  'Quiz & Spelletjes': 'M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z',
  'Leren & Ontdekken': 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  'Eten & Drinken':    'M3 2l2.5 7H18l2-5L3 2zM5.5 9L4 22h16l-1.5-13M8 15h8M10 11v4M14 11v4',
};

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'Tentoonstelling':   Frame,
  'Voorstelling':      Mic2,
  'Activiteit':        Bike,
  'Stappen & Borrel':  PartyPopper,
  'Markt & Beurs':     ShoppingBag,
  'Quiz & Spelletjes': Gamepad2,
  'Leren & Ontdekken': BookOpen,
  'Eten & Drinken':    UtensilsCrossed,
};

interface CategoryIconProps {
  category: typeof CATEGORIES[number] | string;
  className?: string;
  size?: number;
}

export function CategoryIcon({ category, className = "", size = 20 }: CategoryIconProps) {
  const validCategory = CATEGORY_ICONS[category] ? category : 'Activiteit';
  const Icon = CATEGORY_ICONS[validCategory];

  return (
    <Icon
      size={size}
      className={`${className}`}
      style={{ color: CATEGORY_COLORS[validCategory] || '#94A3B8' }}
    />
  );
}

export function getCategoryColor(category: string | undefined): string {
  if (!category) return '#94A3B8';
  return CATEGORY_COLORS[category] || '#94A3B8';
}
