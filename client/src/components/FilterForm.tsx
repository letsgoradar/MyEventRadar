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
  SheetDescription,
  SheetClose
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
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
      ...updates
    });
  };

  // Calculate active filters
  const activeFilters = [
    selectedCategory !== 'all' && 'category',
    showFreeOnly && 'price',
    maxDaysToEvent !== 30 && 'time',
    searchQuery && 'search'
  ].filter(Boolean);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange} defaultSide="right">
      <SheetContent side="right" className="w-[300px] sm:w-[400px] p-0">
        <SheetHeader className="p-4 pb-2">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>
            {searchQuery && (
              <Badge variant="outline" className="mb-2">
                Zoeken: {searchQuery}
              </Badge>
            )}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="space-y-4 p-4">
            {/* Categories */}
            <div>
              <Button
                variant="outline"
                size="sm"
                className={`w-full flex items-center justify-between ${
                  selectedCategory !== 'all' ? 'border-primary text-primary font-medium' : ''
                }`}
                onClick={() => setIsCategoryOpen(!isCategoryOpen)}
              >
                <div className="flex items-center gap-2">
                  <CategoryIcon className="h-4 w-4" />
                  <span>{selectedCategory === 'all' ? 'Alle Categorieën' : selectedCategory}</span>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${isCategoryOpen ? 'rotate-180' : ''}`} />
              </Button>

              {isCategoryOpen && (
                <div className="mt-2 grid gap-1">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`flex items-center gap-2 p-2 rounded hover:bg-gray-100 ${
                      selectedCategory === 'all' ? 'text-primary' : ''
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: categoryColors.all }} />
                    <span className="text-sm">Alle Evenementen ({eventCounts['all'] || 0})</span>
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
                          className={`flex items-center gap-2 p-2 rounded hover:bg-gray-100 ${
                            isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                          } ${selectedCategory === category ? 'text-primary' : ''}`}
                          disabled={isDisabled}
                        >
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-sm capitalize">
                            {category} ({count})
                          </span>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Free/Paid Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Euro className="h-4 w-4" />
                <span>Alleen Gratis</span>
              </div>
              <Switch
                checked={showFreeOnly}
                onCheckedChange={setShowFreeOnly}
              />
            </div>

            {/* Time to Event */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Binnen {maxDaysToEvent} dagen</span>
              </div>
              <div className="px-2">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  className="rounded-md border"
                />
                <div className="mt-4 space-y-2">
                  <Slider
                    value={[maxDaysToEvent]}
                    onValueChange={(values) => setMaxDaysToEvent(values[0])}
                    max={90}
                    step={1}
                  />
                </div>
              </div>
            </div>

            {/* Distance Filter (based on map zoom) */}
            {mapZoomLevel && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>Zoekradius</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Radius wordt automatisch aangepast op basis van het zoomniveau van de kaart
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 p-4 border-t">
          <SheetClose asChild>
            <Button variant="outline" onClick={() => onFilterChange({})}>
              Reset
            </Button>
          </SheetClose>
          <SheetClose asChild>
            <Button>Filter Toepassen</Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}