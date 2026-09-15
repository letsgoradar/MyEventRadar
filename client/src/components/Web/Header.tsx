import * as React from "react";
import { Link } from "wouter";
import { trackSearch } from "@/lib/analytics";
import { MdSearch, MdTune, MdMap, MdViewList } from "react-icons/md";
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
import { EventFilters, ActiveFilterBadges, type EventFilterState } from "@/components/Filters/EventFilters";
import { RadarLogo } from "@/components/RadarLogo";
import { AssistantButton } from "@/components/Assistant/AssistantButton";
import { useAuth } from "@/hooks/use-auth";
import { LogIn, Navigation, MapPin, LocateFixed } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay, addDays, differenceInDays } from "date-fns";
import { nl } from "date-fns/locale";
import { getDistance } from "@/utils/location-utils";
import { useLocation as useGeoLocation, clearSavedLocation, setManualLocation, useCityName } from "@/hooks/useLocation";

// Top-50 Nederlandse steden met coördinaten
const DUTCH_CITIES = [
  { name: 'Amsterdam', lat: 52.3676, lng: 4.9041 },
  { name: 'Rotterdam', lat: 51.9244, lng: 4.4777 },
  { name: 'Den Haag', lat: 52.0705, lng: 4.3007 },
  { name: 'Utrecht', lat: 52.0907, lng: 5.1214 },
  { name: 'Eindhoven', lat: 51.4416, lng: 5.4697 },
  { name: 'Groningen', lat: 53.2194, lng: 6.5665 },
  { name: 'Tilburg', lat: 51.5555, lng: 5.0913 },
  { name: 'Almere', lat: 52.3508, lng: 5.2647 },
  { name: 'Breda', lat: 51.5719, lng: 4.7683 },
  { name: 'Nijmegen', lat: 51.8426, lng: 5.8546 },
  { name: 'Enschede', lat: 52.2215, lng: 6.8937 },
  { name: 'Haarlem', lat: 52.3874, lng: 4.6462 },
  { name: 'Arnhem', lat: 51.9851, lng: 5.8987 },
  { name: 'Amersfoort', lat: 52.1561, lng: 5.3878 },
  { name: 'Apeldoorn', lat: 52.2112, lng: 5.9699 },
  { name: 'Den Bosch', lat: 51.6978, lng: 5.3037 },
  { name: 'Maastricht', lat: 50.8514, lng: 5.6909 },
  { name: 'Leiden', lat: 52.1601, lng: 4.4970 },
  { name: 'Dordrecht', lat: 51.8133, lng: 4.6901 },
  { name: 'Zoetermeer', lat: 52.0578, lng: 4.4938 },
  { name: 'Zwolle', lat: 52.5168, lng: 6.0830 },
  { name: 'Deventer', lat: 52.2512, lng: 6.1583 },
  { name: 'Delft', lat: 52.0116, lng: 4.3571 },
  { name: 'Alkmaar', lat: 52.6324, lng: 4.7534 },
  { name: 'Venlo', lat: 51.3704, lng: 6.1724 },
  { name: 'Hilversum', lat: 52.2292, lng: 5.1725 },
  { name: 'Zaandam', lat: 52.4392, lng: 4.8153 },
  { name: 'Oss', lat: 51.7669, lng: 5.5185 },
  { name: 'Almelo', lat: 52.3564, lng: 6.6637 },
  { name: 'Leeuwarden', lat: 53.2012, lng: 5.7999 },
  { name: 'Sittard', lat: 51.0005, lng: 5.8724 },
  { name: 'Helmond', lat: 51.4817, lng: 5.6614 },
  { name: 'Heerlen', lat: 50.8878, lng: 5.9794 },
  { name: 'Ede', lat: 52.0461, lng: 5.6630 },
  { name: 'Roosendaal', lat: 51.5308, lng: 4.4614 },
  { name: 'Emmen', lat: 52.7797, lng: 6.9003 },
  { name: 'Nijkerk', lat: 52.2197, lng: 5.4909 },
  { name: 'Harderwijk', lat: 52.3420, lng: 5.6228 },
  { name: 'Gouda', lat: 52.0116, lng: 4.7067 },
  { name: 'Purmerend', lat: 52.5027, lng: 4.9575 },
  { name: 'Middelburg', lat: 51.4987, lng: 3.6136 },
  { name: 'Vlaardingen', lat: 51.9122, lng: 4.3414 },
  { name: 'Alphen aan den Rijn', lat: 52.1278, lng: 4.6569 },
  { name: 'Bergen op Zoom', lat: 51.4942, lng: 4.2878 },
  { name: 'Lelystad', lat: 52.5185, lng: 5.4714 },
  { name: 'Spijkenisse', lat: 51.8447, lng: 4.3296 },
  { name: 'Assen', lat: 52.9925, lng: 6.5642 },
  { name: 'Woerden', lat: 52.0875, lng: 4.8856 },
  { name: 'Veenendaal', lat: 52.0275, lng: 5.5575 },
  { name: 'Schiedam', lat: 51.9213, lng: 4.3983 },
];

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
  eventFilters?: EventFilterState;
  onEventFiltersChange?: (filters: EventFilterState) => void;
  resultCount?: number;
  isFilterSidebarOpen?: boolean;
  onFilterSidebarOpenChange?: (open: boolean) => void;
  onLoginClick?: () => void;
}

// Isolated so its interval never triggers a re-render of Header
const SEARCH_SUGGESTIONS_HEADER = ['pubquiz','kermis','circus','festival','comedy','theater','concert','markt','sport','muziek'];
interface AnimatedHeaderInputProps {
  searchQuery: string;
  className?: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}
const AnimatedHeaderInput = React.memo(function AnimatedHeaderInput({
  searchQuery, className, onChange, onKeyDown
}: AnimatedHeaderInputProps) {
  const [idx, setIdx] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % SEARCH_SUGGESTIONS_HEADER.length), 3000);
    return () => clearInterval(t);
  }, []);
  return (
    <Input
      placeholder={searchQuery ? '' : `Zoek op ${SEARCH_SUGGESTIONS_HEADER[idx]}...`}
      className={className}
      value={searchQuery}
      onChange={onChange}
      onKeyDown={onKeyDown}
    />
  );
});

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
  eventFilters,
  onEventFiltersChange,
  resultCount,
  isFilterSidebarOpen,
  onFilterSidebarOpenChange,
  onLoginClick,
}: HeaderProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = React.useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = React.useState(false);
  const [locationPopoverOpen, setLocationPopoverOpen] = React.useState(false);
  const [gpsLoading, setGpsLoading] = React.useState(false);
  const cityName = useCityName();

  const handleGoToMyLocation = React.useCallback(() => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setManualLocation(coords);
        // Vlieg naar nieuwe locatie op de kaart
        try {
          const mapRef = (window as any).mapRef;
          if (mapRef?.current) {
            mapRef.current.flyTo([coords.lat, coords.lng], 13, { animate: true, duration: 1 });
          }
        } catch {}
        setGpsLoading(false);
        setLocationPopoverOpen(false);
      },
      () => { setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const handleSelectCity = React.useCallback((city: { name: string; lat: number; lng: number }) => {
    setManualLocation({ lat: city.lat, lng: city.lng });
    try {
      const mapRef = (window as any).mapRef;
      if (mapRef?.current) {
        mapRef.current.flyTo([city.lat, city.lng], 13, { animate: true, duration: 1 });
      }
    } catch {}
    setLocationPopoverOpen(false);
  }, []);

  // Date range state - geen default, toont alle events
  const today = startOfDay(new Date());
  
  const [localStartDate, setLocalStartDate] = React.useState<Date | null>(null);
  const [localEndDate, setLocalEndDate] = React.useState<Date | null>(null);
  
  // Prioriteit: eventFilters > props > local state
  const startDate = eventFilters?.startDate ?? (propStartDate !== undefined ? propStartDate : localStartDate);
  const endDate = eventFilters?.endDate ?? (propEndDate !== undefined ? propEndDate : localEndDate);
  
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
    
    // Ook eventFilters bijwerken voor API call
    if (eventFilters && onEventFiltersChange) {
      onEventFiltersChange({
        ...eventFilters,
        startDate: start,
        endDate: end
      });
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

  // Gebruikerslocatie voor afstandsberekening (via centrale hook)
  const { location: geoLocation } = useGeoLocation();

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
            const distance = (geoLocation?.lat != null && geoLocation?.lng != null)
              ? getDistance(
                  geoLocation.lat,
                  geoLocation.lng,
                  Number(event.latitude),
                  Number(event.longitude)
                )
              : Infinity;
            
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
  }, [searchQuery, startDate, endDate, geoLocation?.lat, geoLocation?.lng]);

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
    const term = value || searchQuery;
    onSearch?.(term);
    setSearchQuery(term);
    if (term.length >= 2) trackSearch(term);
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
    <div className="relative z-[120] flex min-h-16 items-center gap-3 border-b border-border bg-background/95 px-3 py-2 backdrop-blur-md pointer-events-auto shadow-[0_8px_24px_hsl(var(--foreground)/0.08)] md:px-4">
      {/* Search leads the compact web chrome; the full wordmark is intentionally omitted. */}
      <div className="flex min-w-0 flex-1 items-center justify-start gap-2">
        {/* AI Assistent tijdelijk verborgen */}
        {/* <AssistantButton variant="header" /> */}
        
        {/* Zoekveld */}
          <div className="relative min-w-0 flex-1 max-w-[min(100%,48rem)]">
          <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5 z-10" />
          <div className="relative">
            <AnimatedHeaderInput
              searchQuery={searchQuery}
               className="pl-10 pr-24 h-10 text-base rounded-full shadow-sm border-border bg-card"
              onChange={handleSearchChange}
              onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit("")}
            />
            {searchQuery.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                 className="absolute right-16 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 rounded-full text-muted-foreground hover:text-foreground"
                onClick={clearSearch}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18"></path>
                  <path d="m6 6 12 12"></path>
                </svg>
              </Button>
            )}
            <button
              onClick={() => handleSearchSubmit("")}
              className="absolute right-1 top-1/2 -translate-y-1/2 bg-primary text-white text-sm font-medium px-4 py-1.5 rounded-full hover:bg-primary/90 transition-colors"
            >
              Zoek
            </button>
            
            {/* Live zoekresultaten dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 border border-border shadow-md rounded-md overflow-hidden z-50 bg-card max-h-[400px] overflow-y-auto">
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
                   className="w-full p-3 text-left hover:bg-muted text-primary font-medium border-b border-border flex items-center gap-2"
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
                       className={`p-3 hover:bg-muted cursor-pointer border-b border-border flex items-start gap-3 ${!result.inViewport ? 'bg-muted/60' : ''}`}
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
              <Button 
                variant={endDate ? "default" : "outline"} 
                size="sm" 
                className={cn(
                  "h-10 rounded-full flex items-center gap-1",
                  endDate && "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                <Calendar className="h-4 w-4" />
                <span>
                  {!startDate && !endDate 
                    ? "Alle data" 
                    : !startDate && endDate
                      ? `Komende ${differenceInDays(endDate, today) + 1} dagen`
                      : startDate && endDate
                        ? `${differenceInDays(endDate, startDate) + 1} dagen`
                        : startDate
                          ? format(startDate, 'd MMM', { locale: nl })
                          : "Alle data"}
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
      
      {/* Relevant tools and account controls share one compact navigation rail. */}
      <div className="flex shrink-0 items-center gap-1.5">
        <Link href="/adverteren" className="hidden h-10 items-center rounded-full border border-border/70 bg-card/60 px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground md:flex">
          Adverteren
        </Link>

        {/* Locatie knop met dropdown */}
        <Popover open={locationPopoverOpen} onOpenChange={setLocationPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cityName ? "h-10 max-w-[150px] rounded-full px-3 flex items-center gap-1.5" : "h-10 w-10 rounded-full"}
              title="Locatie wijzigen"
            >
              <RadarLogo size={18} className="flex-shrink-0" />
              {cityName && (
                <span className="text-sm font-medium truncate">{cityName}</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="end">
            {/* GPS locatie */}
            <button
              onClick={handleGoToMyLocation}
              disabled={gpsLoading}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors disabled:opacity-60 border-b"
            >
              <LocateFixed className={`h-4 w-4 text-primary flex-shrink-0 ${gpsLoading ? 'animate-pulse' : ''}`} />
              <div className="text-left">
                <div className="font-medium">{gpsLoading ? 'Locatie bepalen…' : 'Mijn locatie gebruiken'}</div>
                <div className="text-xs text-muted-foreground">Ga terug naar je GPS-positie</div>
              </div>
            </button>
            {/* Stad zoeken */}
            <Command>
              <CommandInput placeholder="Zoek een stad…" className="h-9" />
              <CommandList className="max-h-52">
                <CommandEmpty>Geen resultaat</CommandEmpty>
                <CommandGroup heading="Steden">
                  {DUTCH_CITIES.map((city) => (
                    <CommandItem
                      key={city.name}
                      value={city.name}
                      onSelect={() => handleSelectCity(city)}
                      className="cursor-pointer"
                    >
                      <Navigation className="h-3.5 w-3.5 mr-2 text-muted-foreground flex-shrink-0" />
                      {city.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
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
        
        {/* User profile / Login */}
        {user ? (
          <Link href="/web/profile" className="relative flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    <UserAvatar user={user} size="md" className="border border-border hover:border-primary/50 transition-colors flex-shrink-0" />
                    <span className="hidden md:inline text-sm font-medium max-w-[120px] truncate">
                      {user.username || user.name || ''}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Mijn Profiel</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Link>
        ) : (
          <Button
            variant="default"
            size="sm"
            className="h-10 px-4 rounded-full flex items-center gap-2"
            onClick={() => onLoginClick?.()}
          >
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">Inloggen</span>
          </Button>
        )}
      </div>
    </div>
  );
}

export default Header;