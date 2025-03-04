import { 
  Tag as CategoryIcon,
  Euro,
  Clock,
  Search,
  ChevronDown,
  MapPin
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetClose
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Calendar } from "@/components/ui/calendar";
import { format, differenceInDays } from "date-fns";
import { nl } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { CATEGORIES } from './CategoryPicker';
import { useState } from 'react';

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

interface FilterFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onFilterChange: (filters: any) => void;
  currentFilters: any;
  eventCounts: Record<string, number>;
  mapZoomLevel?: number;
  searchQuery?: string;
}

export function FilterForm({
  isOpen,
  onOpenChange,
  onFilterChange,
  currentFilters,
  eventCounts,
  mapZoomLevel,
  searchQuery
}: FilterFormProps) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showFreeOnly, setShowFreeOnly] = useState(false);
  const [maxDaysToEvent, setMaxDaysToEvent] = useState(30);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  const handleFilterChange = (updates: Partial<typeof currentFilters>) => {
    onFilterChange({
      ...currentFilters,
      ...updates,
    });
  };

  // Calculate active filters
  const activeFilters = [
    selectedCategory !== 'all' && 'category',
    showFreeOnly && 'price',
    maxDaysToEvent !== 30 && 'time',
    searchQuery && 'search',
    mapZoomLevel && 'distance'
  ].filter(Boolean);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[300px] sm:w-[400px]">
        <SheetHeader className="pb-4">
          <SheetTitle>Filters</SheetTitle>
          {activeFilters.length > 0 && (
            <Badge variant="outline" className="w-fit">
              {activeFilters.length} actieve filters
            </Badge>
          )}
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="space-y-6 pr-4">
            {/* Categories */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CategoryIcon className="h-4 w-4" />
                <span className="font-medium">Categorieën</span>
              </div>
              <button
                onClick={() => setSelectedCategory('all')}
                className={`flex items-center gap-2 p-2 rounded-lg w-full hover:bg-gray-100 ${
                  selectedCategory === 'all' ? 'text-primary' : ''
                }`}
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
                      onClick={() => !isDisabled && setSelectedCategory(category)}
                      className={`flex items-center gap-2 p-2 rounded-lg w-full ${
                        isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'
                      } ${selectedCategory === category ? 'text-primary' : ''}`}
                      disabled={isDisabled}
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <span className="capitalize">
                        {category} ({count})
                      </span>
                    </button>
                  );
                })}
            </div>

            {/* Free/Paid Filter */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Euro className="h-4 w-4" />
                <span className="font-medium">Prijs</span>
              </div>
              <div className="flex items-center justify-between p-2">
                <span>Alleen gratis evenementen</span>
                <Switch
                  checked={showFreeOnly}
                  onCheckedChange={setShowFreeOnly}
                />
              </div>
            </div>

            {/* Time Filter */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="font-medium">Tijd</span>
              </div>
              <div className="px-2">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm">Startdatum:</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    onClick={() => setSelectedDate(new Date())}
                  >
                    {format(selectedDate, 'PPP', { locale: nl })}
                  </Button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Binnen dagen:</span>
                    <span className="text-sm font-medium">{maxDaysToEvent}</span>
                  </div>
                  <Slider
                    value={[maxDaysToEvent]}
                    onValueChange={(values) => setMaxDaysToEvent(values[0])}
                    max={90}
                    step={1}
                  />
                </div>
              </div>
            </div>

            {/* Distance Filter */}
            {mapZoomLevel && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span className="font-medium">Afstand</span>
                </div>
                <div className="text-sm text-muted-foreground p-2">
                  Zoekradius wordt automatisch aangepast op basis van het zoomniveau van de kaart
                </div>
              </div>
            )}

            {/* Search Query */}
            {searchQuery && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  <span className="font-medium">Zoekopdracht</span>
                </div>
                <div className="p-2">
                  <Badge variant="secondary" className="text-xs">
                    "{searchQuery}"
                  </Badge>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <SheetClose asChild>
            <Button variant="outline" onClick={() => onFilterChange({})}>
              Reset
            </Button>
          </SheetClose>
          <SheetClose asChild>
            <Button onClick={() => handleFilterChange({
              category: selectedCategory !== 'all' ? selectedCategory : undefined,
              showFreeOnly,
              maxDaysToEvent,
              selectedDate: selectedDate.toISOString(),
            })}>
              Toepassen
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}