import * as React from "react";
import { Search, Filter, Map, List, CalendarIcon, Euro, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DateRangeFilter } from "@/components/Filters/DateRangeFilter";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@shared/schema";
import { CategoryIcon } from "@/components/CategoryIcon";
import { nl } from "date-fns/locale";
import { format, addDays, startOfDay, differenceInDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useOutsideClick } from "@/hooks/use-outside-click";
import { useLocation as useGeoLocation } from "@/hooks/useLocation";

interface AppHeaderProps {
  isMapView: boolean;
  toggleView: () => void;
  onSearch?: (query: string) => void;
  radius?: number;
  onRadiusChange?: (value: number) => void;
  onCategoriesChange?: (categories: string[]) => void;
  onDateRangeChange?: (startDate: Date | null, endDate: Date | null) => void;
}

const DEFAULT_RADIUS = 10; // Standaard radius in km

export function AppHeader({
  isMapView,
  toggleView,
  onSearch,
  radius = DEFAULT_RADIUS,
  onRadiusChange,
  onCategoriesChange,
  onDateRangeChange,
}: AppHeaderProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showResults, setShowResults] = React.useState(false);
  const [showTimeFilter, setShowTimeFilter] = React.useState(false);
  const [showRadiusSlider, setShowRadiusSlider] = React.useState(false);
  const [showPriceFilter, setShowPriceFilter] = React.useState(false);
  const [timeRange, setTimeRange] = React.useState<number[]>([168]); // Default 1 week (168 hours)
  const [priceRange, setPriceRange] = React.useState<number[]>([50]); // Default max price
  const [showOnlyFree, setShowOnlyFree] = React.useState(false);
  const [sortBy, setSortBy] = React.useState<'distance' | 'startTime'>('distance');
  
  // Default: vandaag + 14 dagen
  const [startDate, setStartDate] = React.useState<Date | null>(() => startOfDay(new Date()));
  const [endDate, setEndDate] = React.useState<Date | null>(() => addDays(startOfDay(new Date()), 14));
  
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);
  
  // Synchroniseer date range met parent bij mount
  React.useEffect(() => {
    onDateRangeChange?.(startDate, endDate);
  }, []);
  const [, setLocation] = useLocation();
  const { location: userLocation } = useGeoLocation();

  // Refs for clickaway handlers
  const timeFilterRef = React.useRef<HTMLDivElement>(null);
  const radiusSliderRef = React.useRef<HTMLDivElement>(null);
  const priceFilterRef = React.useRef<HTMLDivElement>(null);
  const searchResultsRef = React.useRef<HTMLDivElement>(null);

  // Close filters when clicking outside
  useOutsideClick(timeFilterRef, () => setShowTimeFilter(false));
  useOutsideClick(radiusSliderRef, () => setShowRadiusSlider(false));
  useOutsideClick(priceFilterRef, () => setShowPriceFilter(false));
  useOutsideClick(searchResultsRef, () => setShowResults(false));

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    onSearch?.(value);
  };

  const handleRadiusChange = (value: number[]) => {
    onRadiusChange?.(value[0]);
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => {
      const newCategories = prev.includes(category)
        ? prev.filter(cat => cat !== category)
        : [...prev, category];
        
      // Stuur de categoriewijziging door naar de parent
      onCategoriesChange?.(newCategories);
      return newCategories;
    });
  };

  // Helper functie voor het formatteren van de afstand
  const formatRadius = (value: number) => {
    if (value >= 1000) {
      return "Heel Nederland";
    }
    if (value === 1) {
      return "1 km";
    }
    return `${value} km`;
  };

  return (
    <div className="sticky top-0 z-10 bg-background">
      <div className="flex items-center justify-between py-3 px-4 border-b">
        <div className="flex items-center gap-2 w-full">
          <div className="relative flex-1">
            <Input
              type="text"
              placeholder="Zoek evenementen..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pr-10 w-full"
            />
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          </div>
          
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-10">
                  <Filter className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <h3 className="font-medium">Filters</h3>
                  
                  {/* Categorieën */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Categorieën</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {CATEGORIES.map((category) => (
                        <Button
                          key={category}
                          variant={selectedCategories.includes(category) ? "default" : "outline"}
                          className={cn(
                            "h-auto py-1 px-2 text-xs justify-start gap-1",
                            selectedCategories.includes(category) && "bg-primary text-primary-foreground"
                          )}
                          onClick={() => toggleCategory(category)}
                        >
                          <CategoryIcon category={category} size={14} />
                          <span className="truncate">{category}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  
                  {/* Datum range selectie */}
                  <div>
                    <DateRangeFilter
                      startDate={startDate}
                      endDate={endDate}
                      onRangeChange={(start, end) => {
                        setStartDate(start);
                        setEndDate(end);
                        onDateRangeChange?.(start, end);
                      }}
                      onReset={() => {
                        const today = startOfDay(new Date());
                        const defaultEnd = addDays(today, 14);
                        setStartDate(today);
                        setEndDate(defaultEnd);
                        onDateRangeChange?.(today, defaultEnd);
                      }}
                    />
                  </div>
                  
                  {/* Prijs */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Prijs</h4>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="free-events"
                        checked={showOnlyFree}
                        onCheckedChange={setShowOnlyFree}
                      />
                      <Label htmlFor="free-events">Alleen gratis evenementen</Label>
                    </div>
                    {!showOnlyFree && (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Max prijs: €{priceRange[0]}
                        </p>
                        <Slider
                          defaultValue={priceRange}
                          max={100}
                          step={1}
                          onValueChange={setPriceRange}
                          disabled={showOnlyFree}
                        />
                      </>
                    )}
                  </div>
                  
                  {/* Sorteren */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Sorteren op</h4>
                    <RadioGroup
                      defaultValue={sortBy}
                      onValueChange={(value) => setSortBy(value as 'distance' | 'startTime')}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="distance" id="distance" />
                        <Label htmlFor="distance">Afstand</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="startTime" id="startTime" />
                        <Label htmlFor="startTime">Datum</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10"
              onClick={toggleView}
            >
              {isMapView ? <List className="h-4 w-4" /> : <Map className="h-4 w-4" />}
            </Button>
            
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </div>
  );
}

export default AppHeader;