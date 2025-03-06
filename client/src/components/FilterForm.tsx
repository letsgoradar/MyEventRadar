import { 
  Tag as CategoryIcon,
  Euro,
  Clock,
  Search,
  MapPin,
  ChevronDown
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
import { useState } from 'react';
import { cn } from '@/lib/utils';

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
  // State for opened sections
  const [openSection, setOpenSection] = useState<string | null>(null);

  // Local state that syncs with parent
  const [selectedCategory, setSelectedCategory] = useState(currentFilters.category || 'all');
  const [showFreeOnly, setShowFreeOnly] = useState(currentFilters.showFreeOnly);
  const [maxDaysToEvent, setMaxDaysToEvent] = useState(currentFilters.maxDaysToEvent || 30);
  const [selectedDate, setSelectedDate] = useState<Date>(
    currentFilters.selectedDate ? new Date(currentFilters.selectedDate) : new Date()
  );

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

  // Toggle section visibility
  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

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
          <div className="space-y-4 pr-4">
            {/* Categories Section */}
            <div className="space-y-2">
              <Button
                variant="ghost"
                className={cn(
                  "w-full flex items-center justify-between",
                  selectedCategory !== 'all' && "text-primary"
                )}
                onClick={() => toggleSection('categories')}
              >
                <div className="flex items-center gap-2">
                  <CategoryIcon className="h-4 w-4" />
                  <span>Categorieën</span>
                  {selectedCategory !== 'all' && (
                    <Badge variant="outline" className="ml-2">
                      {selectedCategory}
                    </Badge>
                  )}
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform",
                  openSection === 'categories' && "rotate-180"
                )} />
              </Button>

              {openSection === 'categories' && (
                <div className="grid gap-1 mt-2 pl-8">
                  <button
                    onClick={() => {
                      setSelectedCategory('all');
                      handleFilterChange({ category: '' });
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
                              setSelectedCategory(category);
                              handleFilterChange({ category });
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
              )}
            </div>

            {/* Free/Paid Filter */}
            <div className="space-y-2">
              <Button
                variant="ghost"
                className={cn(
                  "w-full flex items-center justify-between",
                  showFreeOnly && "text-primary"
                )}
                onClick={() => toggleSection('price')}
              >
                <div className="flex items-center gap-2">
                  <Euro className="h-4 w-4" />
                  <span>Prijs</span>
                  {showFreeOnly && (
                    <Badge variant="outline" className="ml-2">
                      Alleen Gratis
                    </Badge>
                  )}
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform",
                  openSection === 'price' && "rotate-180"
                )} />
              </Button>

              {openSection === 'price' && (
                <div className="flex items-center justify-between pl-8 mt-2">
                  <span>Alleen gratis evenementen</span>
                  <Switch
                    checked={showFreeOnly}
                    onCheckedChange={(checked) => {
                      setShowFreeOnly(checked);
                      handleFilterChange({ showFreeOnly: checked });
                    }}
                  />
                </div>
              )}
            </div>

            {/* Time Filter */}
            <div className="space-y-2">
              <Button
                variant="ghost"
                className={cn(
                  "w-full flex items-center justify-between",
                  maxDaysToEvent !== 30 && "text-primary"
                )}
                onClick={() => toggleSection('time')}
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Tijd</span>
                  {maxDaysToEvent !== 30 && (
                    <Badge variant="outline" className="ml-2">
                      Binnen {maxDaysToEvent} dagen
                    </Badge>
                  )}
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform",
                  openSection === 'time' && "rotate-180"
                )} />
              </Button>

              {openSection === 'time' && (
                <div className="space-y-4 pl-8 mt-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        const now = new Date();
                        setSelectedDate(now);
                        handleFilterChange({ selectedDate: now.toISOString() });
                      }}
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
                      onValueChange={(values) => {
                        setMaxDaysToEvent(values[0]);
                        handleFilterChange({ maxDaysToEvent: values[0] });
                      }}
                      max={90}
                      step={1}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Distance Filter */}
            {mapZoomLevel && (
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  className="w-full flex items-center justify-between"
                  onClick={() => toggleSection('distance')}
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>Afstand</span>
                  </div>
                  <ChevronDown className={cn(
                    "h-4 w-4 transition-transform",
                    openSection === 'distance' && "rotate-180"
                  )} />
                </Button>

                {openSection === 'distance' && (
                  <div className="text-sm text-muted-foreground pl-8 mt-2">
                    Zoekradius wordt automatisch aangepast op basis van het zoomniveau van de kaart
                  </div>
                )}
              </div>
            )}

            {/* Search Query */}
            {searchQuery && (
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  className="w-full flex items-center justify-between text-primary"
                  onClick={() => toggleSection('search')}
                >
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    <span>Zoekopdracht</span>
                    <Badge variant="outline" className="ml-2">
                      "{searchQuery}"
                    </Badge>
                  </div>
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <SheetClose asChild>
            <Button 
              variant="outline" 
              onClick={() => {
                setSelectedCategory('all');
                setShowFreeOnly(false);
                setMaxDaysToEvent(30);
                setSelectedDate(new Date());
                handleFilterChange({
                  category: '',
                  showFreeOnly: false,
                  maxDaysToEvent: 30,
                  selectedDate: new Date().toISOString(),
                });
              }}
            >
              Reset
            </Button>
          </SheetClose>
          <SheetClose asChild>
            <Button onClick={() => handleFilterChange({
              category: selectedCategory !== 'all' ? selectedCategory : '',
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