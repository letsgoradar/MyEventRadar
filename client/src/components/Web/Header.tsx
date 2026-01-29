import * as React from "react";
import { Link } from "wouter";
import { MdSearch, MdTune, MdMap, MdViewList, MdCalendarToday } from "react-icons/md";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
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
import { DateRangeFilter } from "@/components/Filters/DateRangeFilter";
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay, addDays, differenceInDays } from "date-fns";
import { nl } from "date-fns/locale";
import { getDistance } from "@/utils/location-utils";

interface HeaderProps {
  isMapView: boolean;
  toggleView: () => void;
  onSearch?: (query: string) => void;
  radius?: number;
  onRadiusChange?: (value: number) => void;
  onCategoriesChange?: (categories: string[]) => void;
  onDateRangeChange?: (dateRange: { start: Date; end?: Date } | null) => void;
  hideViewToggle?: boolean;
  onEventClick?: (event: any) => void;
  startDate?: Date | null;
  endDate?: Date | null;
  onStartDateChange?: (date: Date | null) => void;
  onEndDateChange?: (date: Date | null) => void;
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
  startDate: propStartDate,
  endDate: propEndDate,
  onStartDateChange,
  onEndDateChange,
}: HeaderProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = React.useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = React.useState(false);
  
  // Date range state - default vandaag + 14 dagen
  const today = startOfDay(new Date());
  const defaultEndDate = addDays(today, 14);
  
  const [localStartDate, setLocalStartDate] = React.useState<Date | null>(today);
  const [localEndDate, setLocalEndDate] = React.useState<Date | null>(defaultEndDate);
  
  const startDate = propStartDate !== undefined ? propStartDate : localStartDate;
  const endDate = propEndDate !== undefined ? propEndDate : localEndDate;
  
  const handleRangeChange = (start: Date | null, end: Date | null) => {
    if (onStartDateChange) onStartDateChange(start);
    else setLocalStartDate(start);
    
    if (onEndDateChange) onEndDateChange(end);
    else setLocalEndDate(end);
    
    // Datum bereik doorgeven aan parent
    if (onDateRangeChange) {
      if (start) {
        onDateRangeChange({
          start: startOfDay(start),
          end: end ? endOfDay(end) : undefined
        });
      } else {
        onDateRangeChange(null);
      }
    }
  };
  
  // Bij initialisatie of wijziging, datum bereik doorgeven aan parent
  React.useEffect(() => {
    if (onDateRangeChange && startDate) {
      onDateRangeChange({
        start: startOfDay(startDate),
        end: endDate ? endOfDay(endDate) : undefined
      });
    }
  }, []);

  // Gebruikerslocatie voor afstandsberekening
  const [userLocation, setUserLocation] = React.useState<[number, number]>([51.7767, 5.5345]); // Standaard positie

  // Gebruikerslocatie ophalen
  React.useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.error("Fout bij ophalen locatie:", error);
        }
      );
    }
  }, []);

  // Zoekresultaten ophalen van de API op basis van query en datumbereik
  React.useEffect(() => {
    if (searchQuery.trim() === "") {
      setSearchResults([]);
      return;
    }
    
    // API call naar events/search endpoint
    const fetchSearchResults = async () => {
      try {
        let url = `/api/events/search?query=${encodeURIComponent(searchQuery)}`;
        
        // Voeg datumbereik parameters toe op basis van start/end date
        if (startDate) {
          url += `&startDate=${startOfDay(startDate).toISOString()}`;
          if (endDate) {
            url += `&endDate=${endOfDay(endDate).toISOString()}`;
          }
        }
        
        console.log("Searching with URL:", url);
        
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          console.log(`Found ${data.length} search results for "${searchQuery}"`);
          
          // Bereken de afstand voor elk resultaat
          const resultsWithDistance = data.map((event: any) => {
            const distance = getDistance(
              userLocation[0], 
              userLocation[1], 
              Number(event.latitude), 
              Number(event.longitude)
            );
            
            // Haal ook events op die mogelijk buiten de kaart vallen
            // Dit zorgt ervoor dat alle events in de zoekresultaten worden getoond
            let inViewport = true;
            
            // Vraag de huidige viewport bounds op via een window property
            const currentMapBounds = (window as any).currentMapBounds;
            if (currentMapBounds) {
              const eventLatLng = {lat: Number(event.latitude), lng: Number(event.longitude)};
              
              // Check of het event binnen de huidige kaartgrenzen valt
              inViewport = currentMapBounds.contains(eventLatLng);
            }
            
            return {
              ...event,
              distance,
              inViewport
            };
          });
          
          // Sorteer de resultaten op afstand (dichtbijzijnde eerst)
          resultsWithDistance.sort((a: any, b: any) => a.distance - b.distance);
          
          setSearchResults(resultsWithDistance);
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
  }, [searchQuery, startDate, endDate, userLocation]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setShowSearchResults(query.trim() !== "");
    
    // Live events filteren op de kaart tijdens het typen (met kleine vertraging)
    if (query.trim() !== "") {
      const filterTimer = setTimeout(() => {
        onSearch?.(query);
      }, 300);
      
      return () => clearTimeout(filterTimer);
    }
  };
  
  const handleSearchSubmit = (value: string) => {
    setShowSearchResults(false);
    onSearch?.(value || searchQuery);
    // Laat de zoekopdracht in de zoekbalk staan
    setSearchQuery(value || searchQuery);
  };
  
  // Functie om de zoekopdracht te wissen en terug te gaan naar alle evenementen
  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    onSearch?.("");
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
              className="pl-10 pr-10 h-10 text-base rounded-full shadow-sm border-slate-200"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit("")}
            />
            {searchQuery.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 rounded-full"
                onClick={clearSearch}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x">
                  <path d="M18 6 6 18"></path>
                  <path d="m6 6 12 12"></path>
                </svg>
              </Button>
            )}
            
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
                
                {/* Evenementen lijst - geen limiet, sorteren op afstand */}
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
                          // Direct naar exacte locatie van het evenement navigeren
                          navigateToMapEvent(result);
                        }
                        
                        // Originele onEventClick handler alleen aanroepen als we op de kaart willen tonen
                        // zonder de detailpagina te openen
                        if (onEventClick) onEventClick(result);
                      }}
                      className={`p-3 hover:bg-gray-100 cursor-pointer border-b flex items-start gap-3 ${!result.inViewport ? 'bg-gray-50' : ''}`}
                    >
                      <CategoryIcon category={result.category as any} size={20} className="mt-1" />
                      <div className="flex flex-col flex-1">
                        <span className="font-medium">{result.title}</span>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                          <span>{result.category}</span>
                          <span>•</span>
                          <span>{new Date(result.startTime).toLocaleDateString('nl-NL', {
                            day: 'numeric',
                            month: 'short'
                          })}</span>
                          {result.distance !== undefined && (
                            <>
                              <span>•</span>
                              <span className="text-green-600 font-medium">{result.distance.toFixed(1)} km</span>
                            </>
                          )}
                          {!result.inViewport && (
                            <>
                              <span>•</span>
                              <span className="text-orange-500 font-medium text-xs">Buiten huidige kaartgebied</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Datum filterknoppen - DateRangeFilter */}
        <div className="flex items-center ml-2">
          <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 rounded-full flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>
                  {!startDate && !endDate 
                    ? "Datum" 
                    : startDate && endDate
                      ? `${differenceInDays(endDate, startDate) + 1} dagen`
                      : startDate
                        ? format(startDate, 'd MMM', { locale: nl })
                        : "Datum"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-4 w-[300px] z-[100]" align="center">
              <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                onRangeChange={handleRangeChange}
                onReset={() => handleRangeChange(null, null)}
                onClose={() => setDatePopoverOpen(false)}
              />
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
        
        {/* Language Switcher */}
        <LanguageSwitcher />

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