import {
  Tag as CategoryIcon,
  Euro,
  Clock,
  Search,
  MapPin,
  ChevronDown,
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Calendar } from "@/components/ui/calendar";
import { format, differenceInDays } from "date-fns";
import { nl } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface FilterFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onFilterChange: (filters: any) => void;
  currentFilters: any;
  eventCounts: Record<string, number>;
  totalMatchingEvents: number;
  userLocation: [number, number];
  onLocationChange: (location: [number, number]) => void;
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

export function FilterForm({
  isOpen,
  onOpenChange,
  onFilterChange,
  currentFilters,
  eventCounts,
  totalMatchingEvents,
  userLocation,
  onLocationChange
}: FilterFormProps) {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);

  // Local state that syncs with parent
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    currentFilters.categories || Object.keys(categoryColors).filter(cat => cat !== 'all')
  );
  const [showFreeOnly, setShowFreeOnly] = useState(currentFilters.showFreeOnly);
  const [maxPrice, setMaxPrice] = useState<number | null>(currentFilters.maxPrice);
  const [maxDaysToEvent, setMaxDaysToEvent] = useState(currentFilters.maxDaysToEvent || 14);
  const [selectedDate, setSelectedDate] = useState<Date>(
    currentFilters.selectedDate ? new Date(currentFilters.selectedDate) : new Date()
  );
  const [distanceRadius, setDistanceRadius] = useState(currentFilters.distanceRadius || 5);

  // Update local state when currentFilters changes from parent
  useEffect(() => {
    setSelectedCategories(currentFilters.categories || Object.keys(categoryColors).filter(cat => cat !== 'all'));
    setShowFreeOnly(currentFilters.showFreeOnly);
    setMaxPrice(currentFilters.maxPrice);
    setMaxDaysToEvent(currentFilters.maxDaysToEvent || 14);
    setSelectedDate(currentFilters.selectedDate ? new Date(currentFilters.selectedDate) : new Date());
    setDistanceRadius(currentFilters.distanceRadius || 5);
  }, [currentFilters]);

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[300px] sm:w-[400px]">
        <SheetHeader className="pb-4">
          <SheetTitle>Filters</SheetTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {totalMatchingEvents} evenementen gevonden
            </Badge>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="space-y-4 pr-4">
            {/* Categories Section */}
            <div className="space-y-2">
              <Button
                variant="ghost"
                className={cn(
                  "w-full flex items-center justify-between",
                  selectedCategories.length < Object.keys(categoryColors).length - 1 && "text-primary"
                )}
                onClick={() => toggleSection('categories')}
              >
                <div className="flex items-center gap-2">
                  <CategoryIcon className="h-4 w-4" />
                  <span>Categorieën</span>
                  <Badge variant="outline" className="ml-2">
                    {selectedCategories.length} geselecteerd
                  </Badge>
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform",
                  openSection === 'categories' && "rotate-180"
                )} />
              </Button>

              {openSection === 'categories' && (
                <div className="grid gap-1 mt-2 pl-8">
                  {Object.entries(categoryColors)
                    .filter(([cat]) => cat !== 'all')
                    .map(([category, color]) => {
                      const count = eventCounts[category] || 0;
                      const isDisabled = count === 0;
                      const isSelected = selectedCategories.includes(category);

                      return (
                        <button
                          key={category}
                          onClick={() => {
                            if (!isDisabled) {
                              const newCategories = isSelected
                                ? selectedCategories.filter(c => c !== category)
                                : [...selectedCategories, category];
                              setSelectedCategories(newCategories);
                              onFilterChange({
                                ...currentFilters,
                                categories: newCategories
                              });
                            }
                          }}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-lg text-left",
                            isDisabled ? "opacity-50 cursor-not-allowed" : "hover:bg-muted",
                            isSelected && "text-primary"
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
                  (showFreeOnly || maxPrice !== null) && "text-primary"
                )}
                onClick={() => toggleSection('price')}
              >
                <div className="flex items-center gap-2">
                  <Euro className="h-4 w-4" />
                  <span>Prijs</span>
                  {(showFreeOnly || maxPrice !== null) && (
                    <Badge variant="outline" className="ml-2">
                      {showFreeOnly ? 'Alleen Gratis' : `Max €${maxPrice}`}
                    </Badge>
                  )}
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform",
                  openSection === 'price' && "rotate-180"
                )} />
              </Button>

              {openSection === 'price' && (
                <div className="space-y-4 pl-8 mt-2">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="priceFilter"
                        checked={!showFreeOnly && maxPrice === null}
                        onChange={() => {
                          setShowFreeOnly(false);
                          setMaxPrice(null);
                          handleFilterChange({ showFreeOnly: false, maxPrice: null });
                        }}
                        className="w-4 h-4"
                      />
                      <span>Alle evenementen</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="priceFilter"
                        checked={showFreeOnly}
                        onChange={() => {
                          setShowFreeOnly(true);
                          setMaxPrice(null);
                          handleFilterChange({ showFreeOnly: true, maxPrice: null });
                        }}
                        className="w-4 h-4"
                      />
                      <span>Alleen gratis evenementen</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="priceFilter"
                        checked={!showFreeOnly && maxPrice !== null}
                        onChange={() => {
                          setShowFreeOnly(false);
                          setMaxPrice(50);
                          handleFilterChange({ showFreeOnly: false, maxPrice: 50 });
                        }}
                        className="w-4 h-4"
                      />
                      <span>Maximum prijs</span>
                    </label>

                    {!showFreeOnly && maxPrice !== null && (
                      <div className="space-y-2 mt-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Max prijs:</span>
                          <span className="text-sm font-medium">€{maxPrice}</span>
                        </div>
                        <Slider
                          value={[maxPrice || 50]}
                          onValueChange={(values) => {
                            setMaxPrice(values[0]);
                            handleFilterChange({ maxPrice: values[0] });
                          }}
                          max={200}
                          step={5}
                          min={5}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>€5</span>
                          <span>€200</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Time Filter */}
            <div className="space-y-2">
              <Button
                variant="ghost"
                className={cn(
                  "w-full flex items-center justify-between",
                  maxDaysToEvent !== 14 && "text-primary"
                )}
                onClick={() => toggleSection('time')}
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Tijd</span>
                  {maxDaysToEvent !== 14 && (
                    <Badge variant="outline" className="ml-2">
                      {maxDaysToEvent === 999 ? 'Alle events' : `Binnen ${maxDaysToEvent} dagen`}
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
                  <div className="space-y-4">
                    {/* Date Button */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setShowCalendar(!showCalendar)}
                      >
                        {format(selectedDate, 'PPP', { locale: nl })}
                      </Button>
                    </div>

                    {/* Calendar Popover */}
                    {showCalendar && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                        <div className="bg-white p-4 rounded-lg shadow-lg max-w-fit">
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(date) => {
                              if (date) {
                                setSelectedDate(date);
                                setShowCalendar(false);
                                handleFilterChange({
                                  selectedDate: date
                                });
                              }
                            }}
                            className="rounded-md border"
                          />
                          <Button
                            variant="outline"
                            className="w-full mt-2"
                            onClick={() => setShowCalendar(false)}
                          >
                            Sluiten
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Days Range */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Binnen dagen:</span>
                        <span className="text-sm font-medium">
                          {maxDaysToEvent === 999 ? 'Alle' : maxDaysToEvent}
                        </span>
                      </div>
                      <Slider
                        value={[maxDaysToEvent === 999 ? 14 : maxDaysToEvent]}
                        onValueChange={(values) => {
                          const value = values[0];
                          const newValue = value === 14 ? 999 : value;
                          setMaxDaysToEvent(newValue);
                          handleFilterChange({
                            maxDaysToEvent: newValue
                          });
                        }}
                        max={14}
                        step={1}
                        min={1}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>1 dag</span>
                        <span>2 weken</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Location Radius Section */}
            <div className="space-y-2">
              <Button
                variant="ghost"
                className={cn(
                  "w-full flex items-center justify-between",
                  distanceRadius !== 5 && "text-primary"
                )}
                onClick={() => toggleSection('location')}
              >
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>Zoekradius</span>
                  <Badge variant="outline" className="ml-2">
                    {distanceRadius}km
                  </Badge>
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform",
                  openSection === 'location' && "rotate-180"
                )} />
              </Button>

              {openSection === 'location' && (
                <div className="space-y-4 pl-8 mt-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Afstand:</span>
                      <span className="text-sm font-medium">{distanceRadius}km</span>
                    </div>
                    <Slider
                      value={[distanceRadius]}
                      onValueChange={(values) => {
                        setDistanceRadius(values[0]);
                        handleFilterChange({
                          distanceRadius: values[0]
                        });
                      }}
                      max={50}
                      step={1}
                      min={1}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1km</span>
                      <span>50km</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Distance Filter */}
            {/* Removed because mapZoomLevel is not defined */}

            {/* Search Query */}
            {/* Removed because searchQuery is not defined */}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <SheetClose asChild>
            <Button
              variant="outline"
              onClick={() => {
                const defaultFilters = {
                  categories: Object.keys(categoryColors).filter(cat => cat !== 'all'),
                  showFreeOnly: false,
                  maxDaysToEvent: 14,
                  selectedDate: new Date(),
                  maxPrice: null,
                  distanceRadius: 5
                };

                setSelectedCategories(defaultFilters.categories);
                setShowFreeOnly(defaultFilters.showFreeOnly);
                setMaxDaysToEvent(defaultFilters.maxDaysToEvent);
                setSelectedDate(defaultFilters.selectedDate);
                setMaxPrice(defaultFilters.maxPrice);
                setDistanceRadius(defaultFilters.distanceRadius);

                onFilterChange({
                  ...currentFilters,
                  ...defaultFilters
                });
              }}
            >
              Reset
            </Button>
          </SheetClose>
          <SheetClose asChild>
            <Button onClick={() => onFilterChange({
              ...currentFilters,
              categories: selectedCategories,
              showFreeOnly,
              maxDaysToEvent: maxDaysToEvent === 999 ? 14 : maxDaysToEvent,
              selectedDate: selectedDate.toISOString(),
              maxPrice,
              distanceRadius
            })}>
              Toepassen ({totalMatchingEvents})
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}