import * as React from "react";
import { Link } from "wouter";
import { MdSearch, MdTune, MdMap, MdViewList, MdCalendarToday } from "react-icons/md";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@shared/schema";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Check, Calendar } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { 
  ToggleGroup, 
  ToggleGroupItem 
} from "@/components/ui/toggle-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DateTimePicker } from "@/components/date-time-picker";
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay, addDays } from "date-fns";
import { nl } from "date-fns/locale";

interface HeaderProps {
  isMapView: boolean;
  toggleView: () => void;
  onSearch?: (query: string) => void;
  radius?: number;
  onRadiusChange?: (value: number) => void;
  onCategoriesChange?: (categories: string[]) => void;
  onDateRangeChange?: (dateRange: { start: Date; end?: Date }) => void;
  hideViewToggle?: boolean;
  onEventClick?: (event: any) => void;
}

export function Header({
  isMapView,
  toggleView,
  onSearch,
  radius = 10,
  onRadiusChange,
  onCategoriesChange,
  onDateRangeChange,
  hideViewToggle = false,
  onEventClick,
}: HeaderProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = React.useState(false);
  
  // Datumfilter opties
  const [dateFilterValue, setDateFilterValue] = React.useState<string>("deze-week");
  const [customDate, setCustomDate] = React.useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = React.useState<Date | undefined>(undefined);
  
  // Bereken de datumbereiken voor de verschillende filteropties
  const dateRanges = React.useMemo(() => {
    const now = new Date();
    return {
      "deze-week": {
        start: startOfWeek(now, { locale: nl, weekStartsOn: 1 }),
        end: endOfWeek(now, { locale: nl, weekStartsOn: 1 }),
      },
      "vandaag": {
        start: startOfDay(now),
        end: endOfDay(now),
      },
      "morgen": {
        start: startOfDay(addDays(now, 1)),
        end: endOfDay(addDays(now, 1)),
      },
      "specifieke-datum": {
        start: customDate || now,
        end: customEndDate,
      },
    };
  }, [customDate, customEndDate]);

  // Bij wijziging van de datumfilter, nieuwe datum doorgeven aan parent
  React.useEffect(() => {
    if (dateFilterValue && onDateRangeChange) {
      const range = dateRanges[dateFilterValue as keyof typeof dateRanges];
      if (range) {
        console.log("Date range changed:", range);
        onDateRangeChange(range);
      }
    }
  }, [dateFilterValue, dateRanges, onDateRangeChange, customDate, customEndDate]);

  // Zoekresultaten ophalen van de API op basis van query en datumbereik
  React.useEffect(() => {
    if (searchQuery.trim() === "") {
      setSearchResults([]);
      return;
    }
    
    // API call naar events/search endpoint
    const fetchSearchResults = async () => {
      try {
        // Bepaal het huidige datumbereik
        const currentRange = dateRanges[dateFilterValue as keyof typeof dateRanges];
        let url = `/api/events/search?query=${encodeURIComponent(searchQuery)}`;
        
        // Voeg datumbereik parameters toe als ze beschikbaar zijn
        if (currentRange && currentRange.start) {
          url += `&startDate=${currentRange.start.toISOString()}`;
        }
        
        if (currentRange && currentRange.end) {
          url += `&endDate=${currentRange.end.toISOString()}`;
        }
        
        console.log("Searching with URL:", url);
        
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          console.log(`Found ${data.length} search results for "${searchQuery}"`);
          setSearchResults(data);
        }
      } catch (error) {
        console.error("Fout bij zoeken:", error);
        setSearchResults([]);
      }
    };
    
    // Voer de zoekopdracht uit na een korte vertraging om te voorkomen dat er te veel requests worden gedaan
    const debounceTimer = setTimeout(() => {
      fetchSearchResults();
    }, 300);
    
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, dateFilterValue, dateRanges]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setShowSearchResults(query.trim() !== "");
    // We don't call onSearch here immediately, only when a selection is made or search is executed
  };
  
  const handleSearchSubmit = (value: string) => {
    setShowSearchResults(false);
    onSearch?.(value || searchQuery);
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
  
  // Afhandelen van datumfilter wijziging
  const handleDateFilterChange = (value: string) => {
    setDateFilterValue(value);
  };

  return (
    <div className="h-20 border-b border-border bg-background flex items-center px-4 justify-between pointer-events-auto shadow-sm">
      {/* Left side area - empty (was logo) */}
      <div className="w-32 md:w-48"></div>
      
      {/* Center area with search and date filters */}
      <div className="flex items-center justify-center gap-2 max-w-xl flex-1">
        {/* Zoekveld */}
        <div className="relative flex-1">
          <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5 z-10" />
          <div className="relative">
            <Input
              placeholder="Zoek op kaart"
              className="pl-10 h-10 text-base rounded-full shadow-sm border-slate-200"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit("")}
            />
            
            {/* Live zoekresultaten dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 border shadow-md rounded-md overflow-hidden z-50 bg-white max-h-[400px] overflow-y-auto">
                {/* Zoek alle resultaten knop */}
                <button
                  onClick={() => {
                    // Zoekactie uitvoeren
                    handleSearchSubmit("");
                    
                    // Als er een resultaat beschikbaar is, naar het eerste navigeren op de kaart
                    if (searchResults.length > 0) {
                      const firstResult = searchResults[0];
                      const navigateToMapEvent = (window as any).navigateToMapEvent;
                      if (navigateToMapEvent) {
                        console.log("Navigating to first search result on map:", firstResult.title);
                        navigateToMapEvent(firstResult);
                      }
                    }
                  }}
                  className="w-full p-3 text-left hover:bg-gray-100 text-blue-600 font-medium border-b flex items-center gap-2"
                >
                  <MdSearch className="text-muted-foreground h-5 w-5" />
                  <span>
                    Zoek naar "<strong>{searchQuery}</strong>" ({searchResults.length} resultaten)
                  </span>
                </button>
                
                {/* Evenementen lijst - geen limiet */}
                <div className="max-h-[320px] overflow-y-auto">
                  {searchResults.map(result => (
                    <div 
                      key={result.id}
                      onClick={() => {
                        setShowSearchResults(false);
                        handleSearchSubmit(result.title);
                        
                        // Controleer of de globale navigatiefunctie beschikbaar is
                        const navigateToMapEvent = (window as any).navigateToMapEvent;
                        if (navigateToMapEvent) {
                          console.log("Navigating to event on map:", result.title);
                          navigateToMapEvent(result);
                        }
                        
                        // Originele onEventClick handler nog steeds aanroepen als deze bestaat
                        if (onEventClick) onEventClick(result);
                      }}
                      className="p-3 hover:bg-gray-100 cursor-pointer border-b flex items-start gap-3"
                    >
                      <CategoryIcon category={result.category as any} size={20} className="mt-1" />
                      <div className="flex flex-col">
                        <span className="font-medium">{result.title}</span>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{result.category}</span>
                          <span>•</span>
                          <span>{new Date(result.startTime).toLocaleDateString('nl-NL', {
                            day: 'numeric',
                            month: 'short'
                          })}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Datum filterknoppen */}
        <div className="flex items-center ml-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 rounded-full flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>
                  {dateFilterValue === "vandaag" ? "Vandaag" : 
                   dateFilterValue === "morgen" ? "Morgen" : 
                   dateFilterValue === "deze-week" ? "Deze week" : 
                   dateFilterValue === "specifieke-datum" && customDate ? 
                   format(customDate, "d MMM", {locale: nl}) : "Datum"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-2 min-w-[280px]" align="center">
              <div className="grid gap-2">
                <ToggleGroup type="single" value={dateFilterValue} onValueChange={handleDateFilterChange} className="justify-start">
                  <ToggleGroupItem value="deze-week" size="sm" className="text-xs px-3 rounded-full">
                    Deze week
                  </ToggleGroupItem>
                  <ToggleGroupItem value="vandaag" size="sm" className="text-xs px-3 rounded-full">
                    Vandaag
                  </ToggleGroupItem>
                  <ToggleGroupItem value="morgen" size="sm" className="text-xs px-3 rounded-full">
                    Morgen
                  </ToggleGroupItem>
                </ToggleGroup>
                
                <Separator className="my-2" />
                
                <div className="space-y-2">
                  <p className="text-sm font-medium">Specifieke datum</p>
                  <div className="space-y-2">
                    <Label className="text-xs">Startdatum</Label>
                    <DateTimePicker
                      date={customDate}
                      setDate={setCustomDate}
                      mode="date"
                      placement="bottom"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Einddatum (optioneel)</Label>
                    <DateTimePicker
                      date={customEndDate}
                      setDate={setCustomEndDate}
                      mode="date"
                      placement="bottom"
                    />
                  </div>
                  <Button 
                    onClick={() => setDateFilterValue("specifieke-datum")} 
                    className="w-full mt-2"
                    size="sm"
                  >
                    Toepassen
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      
      {/* Right side with filters and user profile */}
      <div className="flex items-center gap-2">
        {/* Filters button */}
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="rounded-full">
              <span>Filters</span>
              {selectedCategories.length > 0 && (
                <span className="ml-1 bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs">
                  {selectedCategories.length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px]" align="end">
            <div className="space-y-6 p-2">
              {/* De afstandsfilter is verwijderd - dit wordt nu bepaald door in/uitzoomen op de kaart */}
              
              <div className="space-y-3">
                <h4 className="font-medium text-lg">Categorieën</h4>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(category => (
                    <Button 
                      key={category}
                      variant={selectedCategories.includes(category) ? "default" : "outline"}
                      className="flex items-center gap-2"
                      size="sm"
                      onClick={() => toggleCategory(category)}
                    >
                      <CategoryIcon category={category as any} size={18} />
                      <span className="text-sm">{category}</span>
                    </Button>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setSelectedCategories([]);
                    onCategoriesChange?.([]);
                  }}
                >
                  Filters wissen
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Toon de kaart/lijst schakelaar alleen indien niet verborgen */}
        {!hideViewToggle && (
          <Button
            size="icon"
            variant="outline"
            onClick={toggleView}
            className="h-10 w-10 rounded-full"
            title={isMapView ? "Lijstweergave" : "Kaartweergave"}
          >
            {isMapView ? (
              <MdViewList className="h-5 w-5" />
            ) : (
              <MdMap className="h-5 w-5" />
            )}
          </Button>
        )}
        
        {/* User profile */}
        <Link href="/web/profile" className="relative">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="h-10 w-10 rounded-full overflow-hidden border border-border hover:border-primary/50 transition-colors">
                  <img 
                    src="/images/default-user.svg" 
                    alt="Profielfoto" 
                    className="h-full w-full object-cover"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Mijn Profiel</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Link>
      </div>
    </div>
  );
}

export default Header;