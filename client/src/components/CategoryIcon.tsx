import { Frame, Music, Drama, Dumbbell, TreePine, Compass, GraduationCap, Presentation, ShoppingBag, UtensilsCrossed, Gamepad2, Tent, PartyPopper, HelpCircle, type LucideIcon } from 'lucide-react';
import { CATEGORIES } from '@shared/schema';

export const CATEGORY_COLORS: Record<string, string> = {
  'Tentoonstelling':            '#8B5CF6',
  'Muziek & Concert':           '#EC4899',
  'Theater, Dans & Film':       '#A855F7',
  'Sport & Bewegen':            '#22C55E',
  'Wandelen, Fietsen & Natuur': '#16A34A',
  'Rondleiding & Uitstap':      '#0EA5E9',
  'Cursus & Workshop':          '#3B82F6',
  'Lezing & Congres':           '#64748B',
  'Markt & Beurs':              '#F59E0B',
  'Eten & Drinken':             '#EF4444',
  'Quiz & Spelletjes':          '#14B8A6',
  'Familie & Vakantie':         '#F97316',
  'Feest & Nachtleven':         '#D946EF',
};

// Simple SVG path shapes per category, used to draw map pin glyphs (ClusterLayer +
// MapView). Consumers fall back to a default path for unknown keys, so this only needs
// to cover the active 13-category set.
export const CATEGORY_PATHS: Record<string, string> = {
  'Tentoonstelling':            'M4 4h16v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm0 0l4 8m8-8l-4 8m-4 0h8',
  'Muziek & Concert':           'M9 18V5l12-2v13M9 13l12-2M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z',
  'Theater, Dans & Film':       'M12 2a3 3 0 100 6 3 3 0 000-6zm-7 9h14M5 21l2-4h10l2 4M12 11v4',
  'Sport & Bewegen':            'M6.5 6.5a2 2 0 113 0 2 2 0 01-3 0zM4 21l4-6 3 2 2-3 4 7M9 11l3 2',
  'Wandelen, Fietsen & Natuur': 'M12 2L4 14h5l-1 8 9-12h-5l1-8z',
  'Rondleiding & Uitstap':      'M12 2a10 10 0 110 20A10 10 0 0112 2zM6.5 8.5c0 1.5 2 4 5.5 4s5.5-2.5 5.5-4M12 12v5',
  'Cursus & Workshop':          'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  'Lezing & Congres':           'M4 4h16v12H4V4zm4 16h8M12 16v4',
  'Markt & Beurs':              'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
  'Eten & Drinken':             'M3 2l2.5 7H18l2-5L3 2zM5.5 9L4 22h16l-1.5-13M8 15h8M10 11v4M14 11v4',
  'Quiz & Spelletjes':          'M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z',
  'Familie & Vakantie':         'M12 3l9 7h-3v9h-4v-6h-4v6H6v-9H3l9-7z',
  'Feest & Nachtleven':         'M5.8 11.3a7 7 0 0112.4 0M12 8v1M8 10l-1.5 1M16 10l1.5 1M9 18h6M10 15l-1 3M14 15l1 3',
};

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'Tentoonstelling':            Frame,
  'Muziek & Concert':           Music,
  'Theater, Dans & Film':       Drama,
  'Sport & Bewegen':            Dumbbell,
  'Wandelen, Fietsen & Natuur': TreePine,
  'Rondleiding & Uitstap':      Compass,
  'Cursus & Workshop':          GraduationCap,
  'Lezing & Congres':           Presentation,
  'Markt & Beurs':              ShoppingBag,
  'Eten & Drinken':             UtensilsCrossed,
  'Quiz & Spelletjes':          Gamepad2,
  'Familie & Vakantie':         Tent,
  'Feest & Nachtleven':         PartyPopper,
};

interface CategoryIconProps {
  category: typeof CATEGORIES[number] | string;
  className?: string;
  size?: number;
}

export function CategoryIcon({ category, className = "", size = 20 }: CategoryIconProps) {
  const Icon = CATEGORY_ICONS[category] ?? HelpCircle;
  const color = CATEGORY_COLORS[category] ?? '#94A3B8';

  return (
    <Icon
      size={size}
      className={`${className}`}
      style={{ color }}
    />
  );
}

export function getCategoryColor(category: string | undefined): string {
  if (!category) return '#94A3B8';
  return CATEGORY_COLORS[category] || '#94A3B8';
}
