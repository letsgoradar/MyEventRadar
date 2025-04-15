import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, List, Map, Search, Sliders, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import MapView from "@/components/Map/MapView";
import App2BottomNav from "./App2BottomNav";
import { Event, CATEGORIES } from "@shared/schema";
import { AnimatePresence, motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CategoryIcon, getCategoryColor } from "@/components/CategoryIcon";

interface App2LayoutProps {
  children: React.ReactNode;
  title: string;
  showMap?: boolean;
  filteredEvents?: Event[];
  header?: React.ReactNode;
  isLoading?: boolean;
  searchQuery?: string;
  radius?: number;
  onSearch?: React.Dispatch<React.SetStateAction<string>>;
  onRadiusChange?: React.Dispatch<React.SetStateAction<number>>;
  onFilteredEventsChange?: React.Dispatch<React.SetStateAction<Event[]>>;
}

export function App2Layout({
  children,
  title,
  showMap = false,
  filteredEvents = [],
  header,
  isLoading = false,
  searchQuery = "",
  radius = 10,
  onSearch,
  onRadiusChange,
  onFilteredEventsChange,
}: App2LayoutProps) {
  const [view, setView] = React.useState<"list" | "map">("list");
  const [mapExpanded, setMapExpanded] = React.useState<boolean>(false);
  const [selectedCategories, setSelectedCategories] = React.useState<typeof CATEGORIES[number][]>([]);
  
  // Bewaar de oorspronkelijke evenementen
  const [originalEvents, setOriginalEvents] = React.useState<Event[]>([]);
  
  // Sla de originele evenementen op wanneer ze voor het eerst binnenkomen
  React.useEffect(() => {
    if (filteredEvents.length > 0 && originalEvents.length === 0) {
      setOriginalEvents(filteredEvents);
    }
  }, [filteredEvents, originalEvents]);
  
  // Filter events gebaseerd op geselecteerde categorieën, maar update niet de state
  const displayedEvents = React.useMemo(() => {
    // Als er geen originele events zijn, gebruik de gefilterde events direct
    if (originalEvents.length === 0) return filteredEvents;
    
    // Als er geen categorieën geselecteerd zijn, toon alle originele evenementen
    if (selectedCategories.length === 0) return originalEvents;
    
    // Filter evenementen op basis van geselecteerde categorieën
    return originalEvents.filter(event => 
      selectedCategories.includes(event.category as typeof CATEGORIES[number])
    );
  }, [selectedCategories, originalEvents, filteredEvents]);
  
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
    setView(prev => prev === "list" ? "map" : "list");
  };
  
  // Functie om de kaart uit te vouwen of in te klappen
  const toggleMapExpanded = () => {
    setMapExpanded(prev => !prev);
  };
  
  // Bereken de hoogte van de kaart op basis van de expandedstatus
  const mapHeight = mapExpanded ? "h-[60vh]" : "h-[30vh]";
  
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
  
  // Maak de inhoud van de pagina op basis van de gekozen weergave
  return (
    <div className="flex flex-col min-h-screen bg-background pb-16">
      {/* Header met titel */}
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="container py-3 px-4">
          <h1 className="text-xl font-semibold">{title}</h1>
          {header}
        </div>
      </header>
      
      {/* Zoekbalk */}
      <div className="container mt-2 px-4">
        <div className="relative mb-3">
          <Input
            placeholder="Zoek evenementen..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="pl-9 pr-4 h-10 w-full border-gray-300"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
        </div>
        
        {/* Filter tags */}
        <div className="flex flex-wrap gap-2 mb-3">
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
        
        {/* Filters popover */}
        <div className="flex justify-between items-center mb-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Sliders className="h-4 w-4" />
                Filters
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
                      onValueChange={handleRadiusChange}
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
                
                <div className="pt-2 flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setSelectedCategories([])}
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
          
          <div className="flex space-x-2">
            <Button
              variant={view === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("list")}
              className="h-9 px-3"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={view === "map" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("map")}
              className="h-9 px-3"
            >
              <Map className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Kaart weergave */}
      {view === "map" && (
        <div className="flex-1">
          <div className={cn("w-full transition-all", mapHeight)}>
            <MapView filteredEvents={displayedEvents} />
          </div>
          <div className="container px-4">
            <Button
              variant="ghost"
              className="w-full flex items-center justify-center py-1"
              onClick={toggleMapExpanded}
            >
              {mapExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-2" />
                  Kaart verkleinen
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-2" />
                  Kaart vergroten
                </>
              )}
            </Button>
          </div>
        </div>
      )}
      
      {/* Lijst weergave - kinderen worden gerenderd */}
      <div className={cn("container pb-4 px-4", view === "map" && "pt-2")}>
        {view === "list" && 
          <div className="space-y-4">
            {children}
          </div>
        }
        {view === "map" && !mapExpanded && 
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        }
      </div>
      
      {/* Bottom navigation */}
      <App2BottomNav />
    </div>
  );
}