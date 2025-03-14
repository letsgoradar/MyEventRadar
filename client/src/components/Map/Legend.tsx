import { CATEGORIES } from '@shared/schema';
import { CATEGORY_COLORS } from '../CategoryIcon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Event } from '@shared/schema';

interface LegendProps {
  events: Event[];
  selectedCategories: string[];
  onToggleCategory: (category: string) => void;
}

export default function Legend({ events, selectedCategories, onToggleCategory }: LegendProps) {
  // Tel events per categorie
  const eventsByCategory = CATEGORIES.reduce((acc, category) => {
    acc[category] = events.filter(event => event.category === category).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="absolute bottom-4 right-4 bg-white/90 p-3 rounded-lg shadow-lg z-[1000]">
      <h3 className="text-sm font-medium mb-2">{events.length} resultaten</h3>
      <div className="space-y-1">
        {CATEGORIES.map((category) => {
          const isSelected = selectedCategories.includes(category);
          return (
            <Button
              key={category}
              variant="ghost"
              className={`w-full justify-start px-2 py-1 h-auto ${
                isSelected ? 'bg-gray-100' : ''
              }`}
              onClick={() => onToggleCategory(category)}
            >
              <div className="flex items-center gap-2 w-full">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[category] }}
                />
                <span className="text-xs flex-1">{category}</span>
                <Badge variant="outline" className="text-xs">
                  {eventsByCategory[category]}
                </Badge>
              </div>
            </Button>
          );
        })}
      </div>
    </div>
  );
}