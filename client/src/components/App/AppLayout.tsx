import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, List, Map, Search, Sliders, X, CalendarDays, User, Clock, LogOut, SortAsc, MapPin } from "lucide-react";
import "./app-styles.css";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import MapView from "@/components/Map/MapView";
import AppBottomNav from "./AppBottomNav";
import { SortMenu, SortDirection, SortField } from "./SortMenuComponent";
import { EventInterface as BaseEvent, CATEGORIES } from "@shared/schema";

// Uitgebreide Event interface met distance property
interface Event extends BaseEvent {
  distance?: number;
}
import { AnimatePresence, motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
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
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

// Filters component om de Popover te isoleren en re-rendering problemen te voorkomen
interface FiltersPopoverProps {
  radius: number;
  selectedCategories: typeof CATEGORIES[number][];
  showExpiredEvents: boolean; 
  onRadiusChange: (values: number[]) => void;
  formatRadius: (radius: number) => string;
  applyFilters: () => void;
  toggleCategory: (category: typeof CATEGORIES[number]) => void;
  toggleShowExpiredEvents: () => void;
}



// Memoized component om de "Maximum update depth exceeded" waarschuwing te voorkomen
const FiltersPopover = React.memo(({
  radius,
  selectedCategories,
  showExpiredEvents,
  formatRadius,
  onRadiusChange,
  toggleCategory,
  applyFilters,
  toggleShowExpiredEvents
}: FiltersPopoverProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Sliders className="h-4 w-4" />
          Filters
          {selectedCategories.length > 0 && (
            <Badge className="ml-1 text-xs h-5 min-w-5 flex items-center justify-center bg-primary text-primary-foreground">
              {selectedCategories.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-4" sideOffset={5}>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Afstand: {formatRadius(radius)}</h3>
            <div className="px-1">
              <Slider
                value={[radius]}
                min={1}
                max={300}
                step={1}
                onValueChange={onRadiusChange}
                className="mb-1"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 km</span>
                <span>Nederland</span>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium mb-2">Categorieën</h3>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((category) => {
                const isSelected = selectedCategories.includes(category);
                return (
                  <Button
                    key={category}
                    size="sm"
                    variant="outline"
                    className={cn(
                      "h-auto py-1 px-2 text-xs justify-start gap-1",
                      isSelected && "bg-primary text-primary-foreground"
                    )}
                    onClick={() => toggleCategory(category)}
                  >
                    <CategoryIcon category={category} size={14} />
                    <span className="truncate">{category}</span>
                  </Button>
                );
              })}
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium mb-2">Geavanceerde opties</h3>
            <div className="flex items-center justify-between">
              <label htmlFor="show-expired" className="text-sm">Toon verlopen evenementen</label>
              <Switch
                id="show-expired"
                checked={showExpiredEvents}
                onCheckedChange={toggleShowExpiredEvents}
              />
            </div>
          </div>
          
          <div className="pt-2 flex justify-end gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                onRadiusChange([10]); // Default radius herstellen
                // Reset categorieën
                if (selectedCategories.length > 0) {
                  // Kopieer de array zodat we niet de originele state aanpassen tijdens iteratie
                  [...selectedCategories].forEach(category => toggleCategory(category));
                }
                // Reset verlopen evenementen als het ingeschakeld is
                if (showExpiredEvents) {
                  toggleShowExpiredEvents();
                }
              }}
            >
              Reset
            </Button>
            <Button 
              size="sm" 
              onClick={applyFilters}
            >
              Toepassen
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  showMap?: boolean;
  filteredEvents?: Event[];
  header?: React.ReactNode;
  isLoading?: boolean;
  searchQuery?: string;
  radius?: number;
  onSearch?: React.Dispatch<React.SetStateAction<string>>;
  onRadiusChange?: React.Dispatch<React.SetStateAction<number>>;
  onFilteredEventsChange?: React.Dispatch<React.SetStateAction<Event[]>>;
  hideBottomNav?: boolean;
  hideBackButton?: boolean;
  showBackButton?: boolean;
  backTo?: string;
}

export function AppLayout({
  children,
  title = "Evenementen",
  showMap = false,
  filteredEvents = [],
  header,
  isLoading = false,
  searchQuery = "",
  radius = 10,
  onSearch,
  onRadiusChange,
  onFilteredEventsChange,
  hideBottomNav = false,
  hideBackButton = false,
  showBackButton = false,
  backTo = "/app",
}: AppLayoutProps) {
  // Standaard tegelweergave (list) in plaats van kaartweergave (map)
  const [view, setView] = React.useState<"list" | "map">("list");
  const [selectedCategories, setSelectedCategories] = React.useState<typeof CATEGORIES[number][]>([]);
  // Standaard geen verlopen evenementen tonen
  const [showExpiredEvents, setShowExpiredEvents] = React.useState<boolean>(false);
  // Sortering van evenementen 
  const [sortField, setSortField] = React.useState<SortField>("time");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("asc");
  
  // Bewaar de oorspronkelijke evenementen
  const [originalEvents, setOriginalEvents] = React.useState<Event[]>([]);
  
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
    
    // Sorteer evenementen op basis van de geselecteerde sorteermethode en -richting
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;
      
      // Bepaal vergelijking op basis van sorteeroptie
      if (sortField === "time") {
        comparison = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      } else if (sortField === "distance") {
        // Controleer of afstand beschikbaar is
        if (a.distance === undefined || b.distance === undefined) return 0;
        comparison = (a.distance || 0) - (b.distance || 0);
      }
      
      // Pas sorteervolgorde toe (oplopend of aflopend)
      return sortDirection === "asc" ? comparison : -comparison;
    });
    
    return filtered;
  }, [selectedCategories, originalEvents, showExpiredEvents, sortField, sortDirection]);
  
  // Update gefilterde events alleen wanneer de gebruiker op Toepassen klikt
  const applyFilters = React.useCallback(() => {
    if (onFilteredEventsChange) {
      onFilteredEventsChange(displayedEvents);
    }
  }, [displayedEvents, onFilteredEventsChange]);
  
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
  
  // Functie voor formatteren van de radius-weergave
  const formatRadius = (value: number) => {
    if (value >= 300) {
      return "Heel Nederland";
    }
    if (value === 1) {
      return "1 km";
    }
    return `${value} km`;
  };
  
  // Functie voor het bijwerken van de zoektekst
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onSearch) {
      onSearch(e.target.value);
    }
  };
  
  // Functie voor het bijwerken van de radius
  const handleRadiusChange = (value: number[]) => {
    if (onRadiusChange) {
      onRadiusChange(value[0]);
    }
  };
  
  // Functie voor het toevoegen/verwijderen van een categorie
  const toggleCategory = (category: typeof CATEGORIES[number]) => {
    setSelectedCategories(prev => {
      return prev.includes(category)
        ? prev.filter(c => c !== category) as typeof CATEGORIES[number][]
        : [...prev, category] as typeof CATEGORIES[number][];
    });
  };
  
  // Functie voor het aan-/uitzetten van verlopen evenementen
  const toggleShowExpiredEvents = () => {
    setShowExpiredEvents(prev => !prev);
  };
  
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
    <div className="flex flex-col min-h-screen bg-background pb-16">
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
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary mr-2">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
            )}
            <h1 className="text-xl font-semibold">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/app2/profile" className="cursor-pointer">
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
      
      {/* Zoekbalk en weergaveknoppen - alleen tonen als niet op profielpagina */}
      {!isProfilePage && (
        <div className="container mt-2 px-4">
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <div className="relative">
                <Input
                  placeholder="Zoek evenementen..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="pl-9 pr-4 h-10 w-full border-gray-300"
                  onKeyDown={(e) => e.key === "Enter" && onSearch && onSearch(searchQuery)}
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                
                {/* Live zoekresultaten dropdown */}
                {searchQuery.trim() !== "" && (
                  <Command className="absolute top-full left-0 right-0 mt-1 border shadow-md rounded-md overflow-hidden z-50 bg-white">
                    <CommandList className="max-h-[300px] overflow-y-auto">
                      <CommandGroup>
                        <CommandItem 
                          onSelect={() => onSearch && onSearch(searchQuery)}
                          className="p-2 cursor-pointer hover:bg-slate-100"
                        >
                          <div className="flex items-center gap-2">
                            <Search className="h-4 w-4 text-muted-foreground" />
                            <span className="flex-1">
                              Zoek naar "<strong>{searchQuery}</strong>"
                            </span>
                          </div>
                        </CommandItem>
                      </CommandGroup>
                      
                      {/* Matching events */}
                      {displayedEvents.length > 0 && (
                        <CommandGroup heading="Overeenkomende evenementen" className="py-2">
                          {(() => {
                            // Filter events die overeenkomen met de zoekopdracht
                            const matchingEvents = displayedEvents.filter(event => 
                              event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              event.description?.toLowerCase().includes(searchQuery.toLowerCase())
                            );
                            
                            // Toon maximaal 5 overeenkomende evenementen
                            return matchingEvents.slice(0, 5).map(event => (
                              <Link href={`/app2/event/${event.id}`} key={event.id}>
                                <CommandItem 
                                  className="py-3 px-2 cursor-pointer hover:bg-slate-100"
                                  onSelect={() => {}} // Dummy handler zodat onSelect niet afgevuurd wordt
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
                                </CommandItem>
                              </Link>
                            ));
                          })()}
                          
                          {/* Toon aantal resultaten indien meer dan 5 */}
                          {(() => {
                            const matchingEventsCount = displayedEvents.filter(event => 
                              event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              event.description?.toLowerCase().includes(searchQuery.toLowerCase())
                            ).length;
                            
                            if (matchingEventsCount > 5) {
                              return (
                                <div className="text-xs text-muted-foreground px-3 py-2 border-t border-border">
                                  + {matchingEventsCount - 5} meer evenementen
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </CommandGroup>
                      )}
                      
                      <CommandGroup heading="Recente zoekacties">
                        {/* Toon de laatste 5 zoekacties uit localStorage */}
                        {(() => {
                          // Haal recente zoekacties op uit localStorage
                          const recentSearches = localStorage.getItem('recentSearches') 
                            ? JSON.parse(localStorage.getItem('recentSearches') || '[]')
                            : [];
                          
                          return recentSearches.slice(0, 5).map((search: string, index: number) => (
                            <CommandItem 
                              key={index}
                              onSelect={() => onSearch && onSearch(search)}
                              className="p-2 cursor-pointer hover:bg-slate-100"
                            >
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>{search}</span>
                              </div>
                            </CommandItem>
                          ));
                        })()}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                )}
              </div>
            </div>
            
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
          </div>
          
          {/* Filter tags */}
          <div className="flex flex-wrap gap-2 mb-3 relative z-10">
            {searchQuery && (
              <Badge className="flex gap-1 items-center bg-primary/10 hover:bg-primary/20 text-primary border-none">
                <span className="truncate">{searchQuery}</span>
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => onSearch && onSearch("")}
                />
              </Badge>
            )}
            
            {radius && radius !== 10 && (
              <Badge className="flex gap-1 items-center bg-primary/10 hover:bg-primary/20 text-primary border-none">
                <span>{formatRadius(radius)}</span>
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => onRadiusChange && onRadiusChange(10)}
                />
              </Badge>
            )}
            
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
          
          {/* Filter en sorteer knoppen tonen in beide weergaven */}
          <div className="flex justify-between items-center mb-3 relative z-10">
            <div className="flex items-center gap-2">
              <FiltersPopover 
                radius={radius}
                selectedCategories={selectedCategories}
                showExpiredEvents={showExpiredEvents}
                onRadiusChange={handleRadiusChange}
                formatRadius={formatRadius}
                applyFilters={applyFilters}
                toggleCategory={toggleCategory}
                toggleShowExpiredEvents={toggleShowExpiredEvents}
              />
              
              {/* SortMenu component voor sortering */}
              {/* Sorteerknop alleen tonen in lijstweergave */}
              <SortMenu 
                sortField={sortField} 
                setSortField={setSortField} 
                sortDirection={sortDirection} 
                setSortDirection={setSortDirection} 
                visible={view === "list"} 
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Kaart weergave - exact tussen de navigatiebalken */}
      {view === "map" && !isProfilePage && (
        <div className="flex-1 app2-layout" id="map-container">
          <div className="w-full h-[calc(100vh-7.5rem)] absolute inset-0 top-[7.5rem] bottom-[56px] z-0 border-t border-b-0 border-border">
            <MapView filteredEvents={displayedEvents} radius={radius} searchQuery={searchQuery} hideZoomControls={true} />
          </div>
        </div>
      )}
      
      {/* Lijst weergave - kinderen worden gerenderd */}
      <div className={cn(
        "container pb-4 px-4",
        view === "map" && !isProfilePage ? "pt-2" : "",
        isProfilePage ? "overflow-auto h-[calc(100vh-11rem)]" : "overflow-auto h-[calc(100vh-16rem)]"
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
      
      {/* Bottom navigation - alleen tonen als niet verborgen */}
      {!hideBottomNav && <AppBottomNav />}
    </div>
  );
}