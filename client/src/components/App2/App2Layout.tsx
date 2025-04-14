import * as React from "react";
import { Event } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES } from "@shared/schema";
import { SearchIcon, X, ListFilter, MapIcon, List, LayoutGrid, FilterX } from "lucide-react";
import { EventList } from "@/components/EventList";
import MapView from "@/components/Map/MapView";
import { App2BottomNav } from "./App2BottomNav";
import { useLocation } from "@/hooks/useLocation";

interface App2LayoutProps {
  children?: React.ReactNode;
  searchQuery?: string;
  radius?: number;
  filteredEvents?: Event[];
  onSearch?: (value: string) => void;
  onRadiusChange?: (value: number) => void;
  onFilteredEventsChange?: (events: Event[]) => void;
}

export function App2Layout({
  children,
  searchQuery = "",
  radius = 10,
  filteredEvents = [],
  onSearch,
  onRadiusChange,
  onFilteredEventsChange,
}: App2LayoutProps) {
  const [showMap, setShowMap] = React.useState(true);
  const [showFilters, setShowFilters] = React.useState(false);
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const [gridView, setGridView] = React.useState(false);
  const [tempSearchQuery, setTempSearchQuery] = React.useState(searchQuery);
  const { location } = useLocation();

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempSearchQuery(e.target.value);
  };

  // Handle search submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(tempSearchQuery);
    }
  };

  // Clear search
  const handleClearSearch = () => {
    setTempSearchQuery("");
    if (onSearch) {
      onSearch("");
    }
  };

  // Handle radius change
  const handleRadiusChange = (value: number[]) => {
    if (onRadiusChange) {
      onRadiusChange(value[0]);
    }
  };

  // Handle category selection
  const handleCategoryChange = (category: string | null) => {
    setSelectedCategory(category);
    
    // If callback for filtered events is provided, filter events by category
    if (onFilteredEventsChange && filteredEvents) {
      if (category === null) {
        // If category is null, use the original filtered events
        onFilteredEventsChange(filteredEvents);
      } else {
        // Filter events by the selected category
        const categoryFilteredEvents = filteredEvents.filter(
          (event) => event.category === category
        );
        onFilteredEventsChange(categoryFilteredEvents);
      }
    }
  };

  // Handle filter reset
  const handleFilterReset = () => {
    setSelectedCategory(null);
    if (onRadiusChange) {
      onRadiusChange(10);
    }
    if (onSearch) {
      onSearch("");
    }
    setTempSearchQuery("");
  };

  // If children are provided, render them inside the layout
  if (children) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex-1 overflow-auto pb-16">
          {children}
        </div>
        <App2BottomNav />
      </div>
    );
  }

  // Otherwise, render the main event list/map view
  return (
    <div className="flex flex-col min-h-screen">
      <div className="px-4 pt-4 pb-2 space-y-4">
        <form onSubmit={handleSearchSubmit} className="relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            className="pl-9 pr-9"
            placeholder="Zoek evenementen..."
            value={tempSearchQuery}
            onChange={handleSearchChange}
          />
          {tempSearchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
              onClick={handleClearSearch}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </form>

        <div className="flex justify-between">
          <Tabs defaultValue={showMap ? "map" : "list"} className="w-full">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger 
                value="map" 
                onClick={() => setShowMap(true)}
                className="flex items-center gap-1.5"
              >
                <MapIcon className="h-4 w-4" />
                <span>Kaart</span>
              </TabsTrigger>
              <TabsTrigger 
                value="list" 
                onClick={() => setShowMap(false)}
                className="flex items-center gap-1.5"
              >
                <List className="h-4 w-4" />
                <span>Lijst</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="flex items-center gap-2 ml-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? "border-primary text-primary" : ""}
            >
              <ListFilter className="h-4 w-4" />
            </Button>
            {!showMap && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setGridView(!gridView)}
                className={gridView ? "border-primary text-primary" : ""}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="space-y-4 py-2 border-t border-b">
            <div>
              <div className="flex justify-between mb-2">
                <h3 className="text-sm font-medium">Afstand: {radius} km</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-xs px-2"
                  onClick={handleFilterReset}
                >
                  <FilterX className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              </div>
              <Slider
                value={[radius]}
                min={1}
                max={50}
                step={1}
                onValueChange={handleRadiusChange}
              />
            </div>
            
            <div>
              <h3 className="text-sm font-medium mb-2">Categorieën</h3>
              <div className="flex flex-wrap gap-1">
                <Badge
                  variant={selectedCategory === null ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => handleCategoryChange(null)}
                >
                  Alle
                </Badge>
                {CATEGORIES.map((category) => (
                  <Badge
                    key={category}
                    variant={selectedCategory === category ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => handleCategoryChange(category)}
                  >
                    {category}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 pb-16">
        {showMap ? (
          <div className="h-full">
            <MapView 
              searchQuery={searchQuery} 
              radius={radius} 
              filteredEvents={filteredEvents}
            />
          </div>
        ) : (
          <div className="p-4">
            <EventList 
              searchQuery={searchQuery} 
              radius={radius} 
              filteredEvents={filteredEvents}
              gridView={gridView}
            />
          </div>
        )}
      </div>

      <App2BottomNav />
    </div>
  );
}

export default App2Layout;