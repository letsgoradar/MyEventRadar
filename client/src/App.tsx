import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from '@/components/ui/toaster'
import { Link, Route, Switch } from "wouter"
import TopNav from "@/components/Layout/TopNav"
import MapView from "@/components/Map/MapView"
import EventList from "@/components/Events/EventList"
import CreateEventPage from "@/pages/create-event"
import EventDetailPage from "@/pages/event-detail"
import BottomNav from "@/components/Layout/BottomNav"
import { FilterForm } from "@/components/FilterForm"
import { Badge } from "@/components/ui/badge"
import { Cross2Icon } from '@radix-ui/react-icons'
import { Search, Euro, CalendarDays, MapPin } from 'lucide-react'

const queryClient = new QueryClient()

interface FilterState {
  searchQuery: string;
  selectedDate: Date | null;
  maxDaysToEvent: number;
  showFreeOnly: boolean;
  maxPrice: number | null;
  distanceRadius: number;
  userLocation: [number, number];
  totalMatchingEvents?: number;
}

export default function App() {
  const [isFilterOpen, setIsFilterOpen] = React.useState(false)
  const [isMapView, setIsMapView] = React.useState(true)
  const [userLocation, setUserLocation] = React.useState<[number, number]>([51.7656, 5.5314])
  const [totalMatchingEvents, setTotalMatchingEvents] = React.useState(0)
  const [openSection, setOpenSection] = React.useState<string | null>(null)

  const [filters, setFilters] = React.useState<FilterState>({
    searchQuery: "",
    selectedDate: new Date(),
    maxDaysToEvent: 14,
    showFreeOnly: false,
    maxPrice: null,
    distanceRadius: 5,
    userLocation: [51.7656, 5.5314]
  })

  const activeFilters = [
    filters.searchQuery && { 
      type: 'search', 
      label: `Zoeken: "${filters.searchQuery}"`,
      icon: <Search className="h-4 w-4" />
    },
    filters.showFreeOnly && { 
      type: 'price', 
      label: 'Alleen gratis',
      icon: <Euro className="h-4 w-4" />
    },
    filters.maxPrice && { 
      type: 'price', 
      label: `Max €${filters.maxPrice}`,
      icon: <Euro className="h-4 w-4" />
    },
    filters.maxDaysToEvent !== 14 && { 
      type: 'time', 
      label: filters.maxDaysToEvent === 999 ? 'Alle events' : `Binnen ${filters.maxDaysToEvent} dagen`,
      icon: <CalendarDays className="h-4 w-4" />
    },
    filters.distanceRadius && { 
      type: 'distance', 
      label: `${filters.distanceRadius}km radius`,
      icon: <MapPin className="h-4 w-4" />
    }
  ].filter(Boolean);

  const toggleView = React.useCallback(() => {
    setIsMapView(prev => !prev);
  }, []);

  const handleFilterChange = React.useCallback((newFilters: Partial<FilterState>) => {
    setFilters(prev => {
      const updated = { ...prev, ...newFilters };
      if (typeof newFilters.totalMatchingEvents !== 'undefined') {
        setTotalMatchingEvents(newFilters.totalMatchingEvents);
      }
      return updated;
    });
  }, []);

  const handleSearch = React.useCallback((query: string) => {
    handleFilterChange({ searchQuery: query });
  }, [handleFilterChange]);

  const handleLocationChange = React.useCallback((location: [number, number]) => {
    setUserLocation(location);
    handleFilterChange({ userLocation: location });
  }, [handleFilterChange]);

  const handleFilterClick = (filterType: string) => {
    setIsFilterOpen(true);
    setOpenSection(filterType);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-screen flex flex-col relative">
        <Switch>
          <Route path="/create-event">
            <CreateEventPage />
          </Route>
          <Route path="/event/:id">
            <EventDetailPage />
          </Route>
          <Route path="/">
            <>
              <TopNav 
                isMapView={isMapView}
                toggleView={toggleView}
                toggleFilterSheet={() => setIsFilterOpen(true)}
                isFilterSheetOpen={isFilterOpen}
                setIsFilterSheetOpen={setIsFilterOpen}
                onSearch={handleSearch}
              />
              <div className="absolute inset-0 top-14 bottom-[75px] z-0">
                {/* Active Filters Display */}
                <div className="absolute top-0 left-0 right-0 z-10 bg-white border-b px-4 py-2 flex flex-wrap gap-2">
                  {activeFilters.map((filter, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="flex items-center gap-2 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleFilterClick(filter.type)}
                    >
                      {filter.icon}
                      <span>{filter.label}</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const updates: any = {};
                          switch (filter.type) {
                            case 'search':
                              updates.searchQuery = '';
                              break;
                            case 'price':
                              updates.showFreeOnly = false;
                              updates.maxPrice = null;
                              break;
                            case 'time':
                              updates.maxDaysToEvent = 14;
                              break;
                            case 'distance':
                              updates.distanceRadius = 5;
                              break;
                          }
                          handleFilterChange(updates);
                        }}
                        className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                      >
                        <Cross2Icon className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>

                {isMapView ? (
                  <MapView
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    setIsFilterOpen={setIsFilterOpen}
                    setOpenSection={setOpenSection}
                  />
                ) : (
                  <div className="h-full overflow-auto pt-12">
                    <EventList
                      filters={filters}
                      sortBy="distance"
                      sortAscending={true}
                    />
                  </div>
                )}
              </div>
              <FilterForm
                isOpen={isFilterOpen}
                onOpenChange={setIsFilterOpen}
                currentFilters={filters}
                onFilterChange={handleFilterChange}
                eventCounts={{}}
                totalMatchingEvents={totalMatchingEvents}
                userLocation={userLocation}
                onLocationChange={handleLocationChange}
                activeSection={openSection}
                onSectionChange={setOpenSection}
              />
              <BottomNav />
            </>
          </Route>
          <Route path="/events">
            <MyEvents />
          </Route>
          <Route path="/favorites">
            <div className="h-screen flex flex-col relative">
              <TopNav />
              <div className="flex-1 overflow-auto p-4 pb-24">
                <h1 className="text-2xl font-bold mb-6">Favorieten</h1>
                <p className="text-center py-12 text-muted-foreground">Deze functie is nog in ontwikkeling.</p>
              </div>
              <BottomNav />
            </div>
          </Route>
          <Route path="/profile">
            <div className="h-screen flex flex-col relative">
              <TopNav />
              <div className="flex-1 overflow-auto p-4 pb-24">
                <h1 className="text-2xl font-bold mb-6">Profiel</h1>
                <p className="text-center py-12 text-muted-foreground">Deze functie is nog in ontwikkeling.</p>
              </div>
              <BottomNav />
            </div>
          </Route>
        </Switch>
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}

const MyEvents = () => {
  return (
    <div className="h-full overflow-auto">
      <EventList 
        filters={{
          searchQuery: "", 
          selectedDate: null, 
          maxDaysToEvent: 14, 
          showFreeOnly: false, 
          maxPrice: null, 
          distanceRadius: 5,
          userLocation: [51.7656, 5.5314]
        }} 
        sortBy="date" 
        sortAscending={true} 
      />
    </div>
  );
};

interface FilterState {
  searchQuery: string;
  categories: string[];
  selectedDate: Date | null;
  maxDaysToEvent: number;
  showFreeOnly: boolean;
  maxPrice: number | null;
  distanceRadius: number;
  userLocation: [number, number];
  totalMatchingEvents?: number; // Added totalMatchingEvents to FilterState
}

// Category colors definition
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