import { CATEGORIES } from '@shared/schema';
import { CATEGORY_COLORS } from '../CategoryIcon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { Event } from '@shared/schema';
import { useState } from 'react';

interface LegendProps {
  events: Event[];
  selectedCategories: string[];
  onToggleCategory: (category: string) => void;
}

export default function Legend({ events, selectedCategories, onToggleCategory }: LegendProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Tel events per categorie
  const eventsByCategory = CATEGORIES.reduce((acc, category) => {
    acc[category] = events.filter(event => event.category === category).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
      <div 
        className={`bg-white/90 rounded-lg shadow-lg z-[1000] transition-all duration-300 ${
          isExpanded ? 'w-64' : 'w-auto'
        }`}
      >
        <div className="flex items-center justify-between p-3">
          <h3 className="text-sm font-medium text-center flex-1">{events.length} resultaten</h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>

        {isExpanded && (
          <div className="space-y-1 px-3 pb-3">
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
        )}
      </div>
    </div>
  );
}