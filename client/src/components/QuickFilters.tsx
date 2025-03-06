import { 
  Tag as CategoryIcon,
  Euro,
  Clock,
  Search,
  ChevronDown
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface QuickFiltersProps {
  selectedCategory: string;
  showFreeOnly: boolean;
  maxDaysToEvent: number;
  searchQuery?: string;
  onFilterChange: (updates: any) => void;
  eventCounts: Record<string, number>;
  position?: 'left' | 'right';
}

const categoryColors = {
  'all': '#666666',
  'festival': '#FF9800',
  'sports': '#2196F3',
  'food': '#4CAF50',
  'culture': '#9C27B0',
  'market': '#FF5722',
  'education': '#607D8B',
  'music': '#E91E63',
  'technology': '#00BCD4',
  'gaming': '#8BC34A',
  'health': '#FFEB3B',
  'nature': '#795548',
};

export function QuickFilters({
  selectedCategory,
  showFreeOnly,
  maxDaysToEvent,
  searchQuery,
  onFilterChange,
  eventCounts,
  position = 'right'
}: QuickFiltersProps) {
  const [isCategoryLegendVisible, setIsCategoryLegendVisible] = useState(false);
  const [isTimeFilterVisible, setIsTimeFilterVisible] = useState(false);
  const quickFiltersRef = useRef<HTMLDivElement>(null);

  // Handle clicking outside quick filters
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (quickFiltersRef.current && !quickFiltersRef.current.contains(event.target as Node)) {
        setIsCategoryLegendVisible(false);
        setIsTimeFilterVisible(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div ref={quickFiltersRef} className={`absolute top-4 ${position === 'right' ? 'right-4' : 'left-4'} z-[1000] flex flex-col gap-1.5`}>
      {/* Categories */}
      <Button
        variant="outline"
        size="icon"
        className={`bg-white/90 hover:bg-white h-8 w-8 relative ${
          selectedCategory !== 'all' ? 'border-primary border-2 text-primary shadow-md' : ''
        }`}
        onClick={() => setIsCategoryLegendVisible(!isCategoryLegendVisible)}
        title="Categorieën"
      >
        <CategoryIcon className="h-4 w-4" />
        {selectedCategory !== 'all' && (
          <div className="absolute left-full ml-2 bg-white rounded px-2 py-1 text-xs whitespace-nowrap shadow-sm border">
            {selectedCategory}
          </div>
        )}
      </Button>

      {/* Free/Paid Toggle with Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className={`bg-white/90 hover:bg-white h-8 w-8 relative ${
              showFreeOnly ? 'border-primary border-2 text-primary shadow-md' : ''
            }`}
            title="Prijs Filter"
          >
            <Euro className="h-4 w-4" />
            {showFreeOnly && (
              <div className="absolute left-full ml-2 bg-white rounded px-2 py-1 text-xs whitespace-nowrap shadow-sm border">
                Alleen gratis
              </div>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48" align="start">
          <div className="space-y-2">
            <button
              className={`w-full text-left px-2 py-1.5 rounded hover:bg-gray-100 ${!showFreeOnly ? 'text-primary' : ''}`}
              onClick={() => onFilterChange({ showFreeOnly: false })}
            >
              Alle evenementen
            </button>
            <button
              className={`w-full text-left px-2 py-1.5 rounded hover:bg-gray-100 ${showFreeOnly ? 'text-primary' : ''}`}
              onClick={() => onFilterChange({ showFreeOnly: true })}
            >
              Alleen gratis
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Time Filter */}
      <Button
        variant="outline"
        size="icon"
        className={`bg-white/90 hover:bg-white h-8 w-8 relative ${
          maxDaysToEvent !== 30 ? 'border-primary border-2 text-primary shadow-md' : ''
        }`}
        onClick={() => setIsTimeFilterVisible(!isTimeFilterVisible)}
        title={`Binnen ${maxDaysToEvent} dagen`}
      >
        <Clock className="h-4 w-4" />
        {maxDaysToEvent !== 30 && (
          <div className="absolute left-full ml-2 bg-white rounded px-2 py-1 text-xs whitespace-nowrap shadow-sm border">
            Binnen {maxDaysToEvent} dagen
          </div>
        )}
      </Button>

      {/* Search Results Indicator */}
      {searchQuery && (
        <Button
          variant="outline"
          size="icon"
          className="bg-white/90 hover:bg-white h-8 w-8 border-primary border-2 text-primary shadow-md"
          title={`Zoeken: "${searchQuery}"`}
        >
          <Search className="h-4 w-4" />
          <div className="absolute left-full ml-2 bg-white rounded px-2 py-1 text-xs whitespace-nowrap shadow-sm border">
            Zoeken: "{searchQuery}"
          </div>
        </Button>
      )}

      {/* Category Legend */}
      {isCategoryLegendVisible && (
        <div className={`absolute top-[52px] ${position === 'right' ? 'right-0' : 'left-0'} z-[1000] bg-white p-2 rounded-lg shadow-md min-w-[200px]`}>
          <div className="grid gap-1.5">
            <button
              onClick={() => {
                onFilterChange({ category: '' });
              }}
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg text-left",
                selectedCategory === 'all' ? "text-primary" : "hover:bg-muted"
              )}
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: categoryColors.all }} />
              <span>Alle Evenementen ({eventCounts['all'] || 0})</span>
            </button>
            {Object.entries(categoryColors)
              .filter(([cat]) => cat !== 'all')
              .map(([category, color]) => {
                const count = eventCounts[category] || 0;
                const isDisabled = count === 0;
                return (
                  <button
                    key={category}
                    onClick={() => {
                      if (!isDisabled) {
                        onFilterChange({ category });
                      }
                    }}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg text-left",
                      isDisabled ? "opacity-50 cursor-not-allowed" : "hover:bg-muted",
                      selectedCategory === category && "text-primary"
                    )}
                    disabled={isDisabled}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                    <span className="capitalize">{category} ({count})</span>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Time Filter Panel */}
      {isTimeFilterVisible && (
        <div className={`absolute top-[52px] ${position === 'right' ? 'right-0' : 'left-0'} z-[1000] bg-white p-2 rounded-lg shadow-md w-[260px]`}>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => onFilterChange({ maxDaysToEvent: 7 })}
              >
                Deze week
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => onFilterChange({ maxDaysToEvent: 30 })}
              >
                Deze maand
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => onFilterChange({ maxDaysToEvent: 90 })}
              >
                Komende 3 maanden
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
