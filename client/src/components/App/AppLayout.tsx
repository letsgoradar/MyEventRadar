import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, List, Map, Search, Sliders, X, CalendarDays, User, Clock, LogOut, SortAsc } from "lucide-react";
import "./app-styles.css";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import MapView from "@/components/Map/MapView";
import type L from "leaflet";
import AppBottomNav from "./AppBottomNav";
import { BottomSheet } from "./BottomSheet";
import { SortMenu, SortDirection } from "./SortMenuComponent";
import { EventInterface as BaseEvent, CATEGORIES } from "@shared/schema";
import { DateRangeFilter } from "@/components/Filters/DateRangeFilter";
import { EventFilters, type EventFilterState } from "@/components/Filters/EventFilters";
import { Calendar } from "lucide-react";
import { format, addDays, startOfDay, differenceInDays } from "date-fns";
import { nl } from "date-fns/locale";

// Uitgebreide Event interface met distance property en tag arrays
interface Event extends BaseEvent {
  distance?: number;
  eventTagIds?: number[];
  targetAudienceIds?: number[];
  seasonalThemeIds?: number[];
}
import { AnimatePresence, motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { CategoryIcon, getCategoryColor } from "@/components/CategoryIcon";
import ProfilePhotoUpload from "./ProfilePhotoUpload";
import { NotificationCenter } from "./NotificationCenter";
import { InstallPrompt } from "@/components/PWA/InstallPrompt";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { RadarLogoWithText } from "@/components/RadarLogo";


interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  showMap?: boolean;
  defaultView?: "list" | "map";
  filteredEvents?: Event[];
  header?: React.ReactNode;
  isLoading?: boolean;
  searchQuery?: string;
  radius?: number;
  onSearch?: React.Dispatch<React.SetStateAction<string>>;
  onRadiusChange?: React.Dispatch<React.SetStateAction<number>>;
  onFilteredEventsChange?: React.Dispatch<React.SetStateAction<Event[]>>;
  onBoundsFilteredEventsChange?: (events: Event[]) => void;
  hideBottomNav?: boolean;
  hideBackButton?: boolean;
  showBackButton?: boolean;
  backTo?: string;
  hideSearchAndFilters?: boolean;
  onEventClick?: (event: Event) => void;
  hideViewToggle?: boolean;
  startDate?: Date | null;
  endDate?: Date | null;
  onStartDateChange?: (date: Date | null) => void;
  onEndDateChange?: (date: Date | null) => void;
  selectedEventId?: number | null;
}

export function AppLayout({
  children,
  title = "Evenementen",
  showMap = false,
  defaultView = "list",
  filteredEvents = [],
  header,
  isLoading = false,
  searchQuery = "",
  radius = 10,
  onSearch,
  onRadiusChange,
  onFilteredEventsChange,
  onBoundsFilteredEventsChange,
  hideBottomNav = false,
  hideBackButton = false,
  showBackButton = false,
  backTo = "/app",
  hideSearchAndFilters = false,
  onEventClick,
  hideViewToggle = false,
  startDate: propStartDate,
  endDate: propEndDate,
  onStartDateChange,
  onEndDateChange,
  selectedEventId,
}: AppLayoutProps) {
  // Date range state - default vandaag + 14 dagen (inclusief vandaag)
  // addDays(today, 13) = vandaag + 13 dagen = 14 dagen totaal
  const today = startOfDay(new Date());
  const defaultEndDate = addDays(today, 13);
  
  const [localStartDate, setLocalStartDate] = React.useState<Date | null>(today);
  const [localEndDate, setLocalEndDate] = React.useState<Date | null>(defaultEndDate);
  
  const startDate = propStartDate !== undefined ? propStartDate : localStartDate;
  const endDate = propEndDate !== undefined ? propEndDate : localEndDate;
  
  const handleRangeChange = (start: Date | null, end: Date | null) => {
    if (onStartDateChange) onStartDateChange(start);
    else setLocalStartDate(start);
    
    if (onEndDateChange) onEndDateChange(end);
    else setLocalEndDate(end);
  };
  // Popover state voor datum filter
  const [datePopoverOpen, setDatePopoverOpen] = React.useState(false);
  
  // Gebruik defaultView als initiële view
  const [view, setView] = React.useState<"list" | "map">(defaultView);
  const [selectedCategories, setSelectedCategories] = React.useState<typeof CATEGORIES[number][]>([]);
  // Event filters state (tags, doelgroepen, thema's)
  const [eventFilters, setEventFilters] = React.useState<EventFilterState>({
    tagIds: [],
    audienceIds: [],
    themeIds: [],
    startDate: null,
    endDate: null
  });
  // Standaard geen verlopen evenementen tonen
  const [showExpiredEvents, setShowExpiredEvents] = React.useState<boolean>(false);
  // Sortering van evenementen (alleen tijd-based)
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("asc");
  // Search dropdown visibility
  const [isSearchFocused, setIsSearchFocused] = React.useState<boolean>(false);
  const searchContainerRef = React.useRef<HTMLDivElement>(null);
  
  // Bewaar de oorspronkelijke evenementen
  const [originalEvents, setOriginalEvents] = React.useState<Event[]>([]);
  
  // Kaart bounds state voor zoom-based filtering
  const [mapBounds, setMapBounds] = React.useState<L.LatLngBounds | null>(null);
  
  // Close search dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Sla de originele evenementen op wanneer ze voor het eerst binnenkomen
  React.useEffect(() => {
    if (filteredEvents.length > 0) {
      setOriginalEvents(filteredEvents);
    }
  }, [filteredEvents]);
  
  // Filter events gebaseerd op geselecteerde categorieën en verlopen evenementen
  const displayedEvents = React.useMemo(() => {
    // Als er geen originele events zijn, gebruik de gefilterde events direct
    if (originalEvents.length === 0) return filteredEvents;
    
    let filtered = originalEvents;
    
    // Filter op basis van categorieën als er categorieën geselecteerd zijn
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(event => 
        selectedCategories.includes(event.category as typeof CATEGORIES[number])
      );
    }
    
    // Filter verlopen evenementen als ze niet getoond moeten worden
    if (!showExpiredEvents) {
      const now = new Date();
      filtered = filtered.filter(event => {
        if (!event.endTime) return true; // Als er geen eindtijd is, toon het evenement
        return new Date(event.endTime) > now;
      });
    }
    
    // Filter events based on tag filters
    if (eventFilters.tagIds.length > 0) {
      filtered = filtered.filter(event => 
        event.eventTagIds && event.eventTagIds.some((tagId: number) => 
          eventFilters.tagIds.includes(tagId)
        )
      );
    }
    
    // Filter events based on audience filters
    if (eventFilters.audienceIds.length > 0) {
      filtered = filtered.filter(event => 
        event.targetAudienceIds && event.targetAudienceIds.some((audienceId: number) => 
          eventFilters.audienceIds.includes(audienceId)
        )
      );
    }
    
    // Filter events based on theme filters
    if (eventFilters.themeIds.length > 0) {
      filtered = filtered.filter(event => 
        event.seasonalThemeIds && event.seasonalThemeIds.some((themeId: number) => 
          eventFilters.themeIds.includes(themeId)
        )
      );
    }
    
    // Filter events based on date range from EventFilters OR header date range
    const filterStartDate = eventFilters.startDate || startDate;
    const filterEndDate = eventFilters.endDate || endDate;
    
    if (filterStartDate || filterEndDate) {
      filtered = filtered.filter(event => {
        const eventStart = new Date(event.startTime);
        if (filterStartDate && eventStart < startOfDay(filterStartDate)) {
          return false;
        }
        if (filterEndDate) {
          const endOfFilterDay = new Date(filterEndDate);
          endOfFilterDay.setHours(23, 59, 59, 999);
          if (eventStart > endOfFilterDay) {
            return false;
          }
        }
        return true;
      });
    }
    
    // Sorteer evenementen op basis van de geselecteerde sorteermethode en -richting
    filtered = [...filtered].sort((a, b) => {
      // Sorteer op tijd
      const comparison = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      
      // Pas sorteervolgorde toe (oplopend of aflopend)
      return sortDirection === "asc" ? comparison : -comparison;
    });
    
    return filtered;
  }, [selectedCategories, originalEvents, showExpiredEvents, sortDirection, eventFilters, startDate, endDate]);
  
  // Events gefilterd op kaart bounds (voor bottom sheet)
  const boundsFilteredEvents = React.useMemo(() => {
    if (!mapBounds || !displayedEvents.length) return displayedEvents;
    
    return displayedEvents.filter(event => {
      if (!event.latitude || !event.longitude) return false;
      return mapBounds.contains([Number(event.latitude), Number(event.longitude)]);
    });
  }, [displayedEvents, mapBounds]);
  
  // Callback naar parent met bounds-filtered events voor navigatie
  React.useEffect(() => {
    if (onBoundsFilteredEventsChange) {
      onBoundsFilteredEventsChange(boundsFilteredEvents);
    }
  }, [boundsFilteredEvents, onBoundsFilteredEventsChange]);
  
  // Update gefilterde events alleen wanneer de gebruiker op Toepassen klikt
  const displayedEventsRef = React.useRef(displayedEvents);
  React.useEffect(() => {
    displayedEventsRef.current = displayedEvents;
  }, [displayedEvents]);

  const applyFilters = React.useCallback(() => {
    if (onFilteredEventsChange) {
      onFilteredEventsChange(displayedEventsRef.current);
    }
  }, [onFilteredEventsChange]);
  
  // Geef voorkeur aan de kaartweergave als showMap=true
  React.useEffect(() => {
    if (showMap && view === "list") {
      setView("map");
    }
  }, [showMap]);
  
  // Functie om te schakelen tussen lijsten kaartweergave
  const toggleView = () => {
    // Zorg eerst dat alle event cards verborgen zijn om overlapprobleem te voorkomen
    const mapContainer = document.getElementById('map-container');
    const listContent = document.querySelector('.list-view-content');
    
    if (view === "list") {
      // Van lijst naar kaart
      if (listContent) listContent.classList.add('hidden-temp');
      setTimeout(() => {
        setView("map");
      }, 50);
    } else {
      // Van kaart naar lijst
      if (mapContainer) mapContainer.classList.add('hidden-temp');
      setTimeout(() => {
        setView("list");
        if (listContent) listContent.classList.remove('hidden-temp');
      }, 50);
    }
  };
  
  // Geen toggleMapExpanded en mapHeight meer nodig aangezien de kaart nu altijd volledig wordt getoond
  
  // Functie voor het bijwerken van de zoektekst
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onSearch) {
      onSearch(e.target.value);
    }
  };
  
  // Functie voor het toevoegen/verwijderen van een categorie - gestabiliseerd met useCallback
  const toggleCategory = React.useCallback((category: typeof CATEGORIES[number]) => {
    setSelectedCategories(prev => {
      return prev.includes(category)
        ? prev.filter(c => c !== category) as typeof CATEGORIES[number][]
        : [...prev, category] as typeof CATEGORIES[number][];
    });
  }, []);
  
  // Typedefinitie voor gebruiker
  interface UserData {
    id: number;
    username: string;
    email: string;
    photoUrl?: string;
    avatar?: string;
    role: string;
  }
  
  // Gebruik de useAuth hook voor authenticatie en logout functionaliteit
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Laad de profielfoto uit localStorage (indien beschikbaar) in een state
  const [savedPhotoUrl, setSavedPhotoUrl] = React.useState<string | null>(null);
  
  // Effect om localStorage te checken voor een profielfoto bij het laden
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedPhotoUrl = localStorage.getItem('profilePhotoUrl');
      console.log("Loading from localStorage:", storedPhotoUrl);
      if (storedPhotoUrl) {
        setSavedPhotoUrl(storedPhotoUrl);
      }
    }
  }, []);
  
  // Effect om localStorage te checken voor updates tijdens navigatie
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const checkLocalStorage = () => {
      const storedPhotoUrl = localStorage.getItem('profilePhotoUrl');
      if (storedPhotoUrl && storedPhotoUrl !== savedPhotoUrl) {
        console.log("Updating photo from localStorage:", storedPhotoUrl);
        setSavedPhotoUrl(storedPhotoUrl);
      }
    };
    
    // Check bij focus van venster (terugnavigatie)
    window.addEventListener('focus', checkLocalStorage);
    return () => window.removeEventListener('focus', checkLocalStorage);
  }, [savedPhotoUrl]);
  
  // Hanteer profielfoto update
  const handleProfilePhotoUpdate = (photoUrl: string) => {
    console.log("handleProfilePhotoUpdate called with:", photoUrl);
    // Update de state zodat het direct zichtbaar is
    setSavedPhotoUrl(photoUrl);
    
    // Sla de URL op in localStorage zodat deze bewaard blijft tussen pagina's
    if (typeof window !== 'undefined') {
      localStorage.setItem('profilePhotoUrl', photoUrl);
      console.log("Saved to localStorage from Layout:", photoUrl);
    }
  };
  
  // Bepaal of we op de profielpagina zijn
  const isProfilePage = title?.includes("Profiel") ?? false;
  
  // Maak de inhoud van de pagina op basis van de gekozen weergave
  return (
    <div className="flex flex-col min-h-[100dvh] bg-background pb-16">
      {/* Header met titel */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b">
        <div className="container py-3 px-4 flex justify-between items-center">
          <div className="flex items-center">
            {(showBackButton && !hideBackButton) ? (
              <Link href={backTo}>
                <Button variant="ghost" size="sm" className="mr-1 p-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </Button>
              </Link>
            ) : (
              title === "Evenementen" ? (
                <RadarLogoWithText height={28} textColor="hsl(var(--foreground))" />
              ) : null
            )}
            <h1 className="text-xl font-semibold">
              {title !== "Evenementen" ? title : null}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationCenter />
            <Link href="/app/profile" className="cursor-pointer">
              <Avatar className="h-8 w-8 border-2 border-primary">
                {savedPhotoUrl ? (
                  <AvatarImage src={savedPhotoUrl} alt="Profielfoto" />
                ) : user?.photoUrl ? (
                  <AvatarImage src={user.photoUrl} alt="Profielfoto" />
                ) : (
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                )}
              </Avatar>
            </Link>
          </div>
          {header}
        </div>
      </header>
      
      {/* Zoekbalk en weergaveknoppen - alleen tonen als niet op profielpagina en hideSearchAndFilters is false */}
      {!isProfilePage && !hideSearchAndFilters && (
        <div className="container mt-2 px-4">
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1" ref={searchContainerRef}>
              <div className="relative">
                <Input
                  placeholder="Zoek evenementen..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="pl-9 pr-4 h-10 w-full border-gray-300"
                  onKeyDown={(e) => e.key === "Enter" && onSearch && onSearch(searchQuery)}
                  onFocus={() => setIsSearchFocused(true)}
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                
                {/* Live zoekresultaten dropdown */}
                {searchQuery.trim() !== "" && isSearchFocused && (
                  <div 
                    className="absolute top-full left-0 right-0 mt-1 border shadow-md rounded-md overflow-hidden z-50 bg-white"
                    style={{ 
                      maxHeight: '50vh', 
                      minHeight: '150px',
                      overflowY: 'auto' 
                    }}
                  >
                    <div className="p-1">
                      <div className="space-y-1">
                        {/* Zoek naar knop */}
                        <div 
                          onClick={() => {
                            onSearch && onSearch(searchQuery);
                            setIsSearchFocused(false);
                          }}
                          className="p-3 cursor-pointer hover:bg-slate-100 border-b border-gray-100 flex items-center gap-2"
                        >
                          <Search className="h-4 w-4 text-muted-foreground" />
                          <span className="flex-1">
                            Zoek naar "<strong>{searchQuery}</strong>"
                          </span>
                        </div>
                        
                        {/* Overeenkomende evenementen */}
                        {displayedEvents.length > 0 && (() => {
                          const matchingEvents = displayedEvents.filter(event => 
                            event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            event.description?.toLowerCase().includes(searchQuery.toLowerCase())
                          );
                          
                          if (matchingEvents.length === 0) return null;
                          
                          return (
                            <div>
                              <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-gray-100">
                                Overeenkomende evenementen
                              </div>
                              {matchingEvents.slice(0, 5).map(event => (
                                <div 
                                  key={event.id}
                                  onClick={() => {
                                    if (onEventClick) {
                                      onEventClick(event);
                                      setIsSearchFocused(false);
                                    }
                                  }}
                                  className="p-3 cursor-pointer hover:bg-slate-100 border-b border-gray-50"
                                >
                                  <div className="flex items-center gap-2">
                                    <CategoryIcon category={event.category as typeof CATEGORIES[number]} className="h-5 w-5" />
                                    <div className="flex-1 flex flex-col">
                                      <span className="font-medium text-sm">{event.title}</span>
                                      <span className="text-xs text-muted-foreground truncate">
                                        {new Date(event.startTime).toLocaleDateString('nl-NL', {
                                          day: 'numeric',
                                          month: 'short',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {matchingEvents.length > 5 && (
                                <div className="text-xs text-muted-foreground px-3 py-2 border-t border-border">
                                  + {matchingEvents.length - 5} meer evenementen
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        
                        {/* Recente zoekacties */}
                        {(() => {
                          try {
                            const recentSearches = localStorage.getItem('recentSearches') 
                              ? JSON.parse(localStorage.getItem('recentSearches') || '[]')
                              : [];
                            
                            if (recentSearches.length === 0) return null;
                            
                            return (
                              <div>
                                <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-gray-100">
                                  Recente zoekacties
                                </div>
                                {recentSearches.slice(0, 5).map((search: string, index: number) => (
                                  <div 
                                    key={index}
                                    onClick={() => {
                                      onSearch && onSearch(search);
                                      setIsSearchFocused(false);
                                    }}
                                    className="p-3 cursor-pointer hover:bg-slate-100 border-b border-gray-50"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm">{search}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          } catch (e) {
                            return null;
                          }
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Datum filter - naast zoekveld */}
            <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant={startDate ? "default" : "outline"} 
                  size="sm" 
                  className="h-10 flex items-center gap-1"
                >
                  <CalendarDays className="h-4 w-4" />
                  <span className="font-medium hidden sm:inline">
                    {!startDate && !endDate 
                      ? "Datum" 
                      : startDate && endDate
                        ? `${differenceInDays(endDate, startDate) + 1} dagen`
                        : startDate
                          ? format(startDate, 'd MMM', { locale: nl })
                          : "Datum"}
                  </span>
                  {startDate && (
                    <Badge className="ml-1 text-xs h-5 min-w-5 flex items-center justify-center bg-background text-foreground sm:hidden">
                      {startDate && endDate ? differenceInDays(endDate, startDate) + 1 : 1}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-4 w-[300px] z-[100]" align="end">
                <DateRangeFilter
                  startDate={startDate}
                  endDate={endDate}
                  onRangeChange={handleRangeChange}
                  onReset={() => handleRangeChange(null, null)}
                  onClose={() => setDatePopoverOpen(false)}
                  showExpiredEvents={showExpiredEvents}
                  onShowExpiredEventsChange={setShowExpiredEvents}
                />
              </PopoverContent>
            </Popover>
            
            {!hideViewToggle && (
              <div className="flex gap-1">
                <Button
                  variant={view === "list" ? "default" : "outline"}
                  size="sm"
                  onClick={() => view !== "list" && toggleView()}
                  className="h-10 px-3"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={view === "map" ? "default" : "outline"}
                  size="sm"
                  onClick={() => view !== "map" && toggleView()}
                  className="h-10 px-3"
                >
                  <Map className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          
          {/* Filter tags - alleen categorieën tonen, geen zoekquery */}
          {selectedCategories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3 relative z-10">
              {selectedCategories.map(category => (
                <Badge 
                  key={category}
                  className="flex gap-1 items-center"
                  style={{ backgroundColor: getCategoryColor(category), color: 'white' }}
                >
                  <CategoryIcon category={category} size={12} className="text-white" />
                  <span>{category}</span>
                  <X 
                    className="h-3 w-3 cursor-pointer text-white" 
                    onClick={() => toggleCategory(category)}
                  />
                </Badge>
              ))}
            </div>
          )}
          
          {/* Sorteer knoppen alleen tonen in lijstweergave */}
          {view === "list" && (
            <div className="flex justify-between items-center mb-3 relative z-10">
              <div className="flex items-center gap-2">
                <SortMenu 
                  sortDirection={sortDirection} 
                  setSortDirection={setSortDirection} 
                  visible={true} 
                />
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Kaart weergave - exact tussen de navigatiebalken */}
      {view === "map" && !isProfilePage && (
        <div className="flex-1 app-layout" id="map-container">
          <div className="w-full h-[calc(100vh-7.5rem)] absolute inset-0 top-[7.5rem] bottom-[106px] z-0 border-t border-b-0 border-border">
            <MapView 
              filteredEvents={displayedEvents} 
              radius={50} 
              searchQuery={searchQuery} 
              hideZoomControls={true}
              onEventClick={onEventClick}
              selectedEventId={selectedEventId}
              onBoundsChange={setMapBounds}
              startDate={startDate}
              endDate={endDate}
            />
            
            {/* Floating Filter knop - linksboven - Airbnb style EventFilters */}
            <div className="absolute top-4 left-4 z-[1000]">
              <EventFilters
                filters={eventFilters}
                onFiltersChange={setEventFilters}
                resultCount={displayedEvents.length}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Lijst weergave - kinderen worden gerenderd */}
      <div className={cn(
        "container pb-4 px-4",
        view === "map" && !isProfilePage ? "pt-2" : "",
        isProfilePage ? "overflow-auto h-[calc(100vh-11rem)]" : hideSearchAndFilters ? "overflow-auto h-[calc(100vh-7rem)]" : "overflow-auto h-[calc(100vh-16rem)]"
      )}>
        {(view === "list" || isProfilePage) && 
          <div className="space-y-4 list-view-content overflow-y-auto">
            {children}
          </div>
        }
        {view === "map" && !isProfilePage && 
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4 map-view-content"
              style={{ display: "none" }}
            >
              {/* Verberg children in kaartweergave om dubbele rendering te voorkomen */}
            </motion.div>
          </AnimatePresence>
        }
      </div>
      
      {/* PWA installatie prompt */}
      <InstallPrompt />
      
      {/* Bottom Sheet voor evenementen - alleen in map view */}
      {view === "map" && !isProfilePage && !hideBottomNav && (
        <BottomSheet 
          events={boundsFilteredEvents}
          onEventClick={onEventClick}
        />
      )}
      
      {/* Bottom navigation - alleen tonen als niet verborgen */}
      {!hideBottomNav && <AppBottomNav />}
    </div>
  );
}

export default AppLayout;