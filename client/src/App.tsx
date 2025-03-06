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

const queryClient = new QueryClient()

interface FilterState {
  searchQuery: string;
  category: string;
  selectedDate: Date | null;
  maxDaysToEvent: number;
  showFreeOnly: boolean;
  useDistanceFilter: boolean;
  distanceRadius: number;
}

// Placeholder MyEvents component - needs implementation to filter by creator
const MyEvents = () => {
  return (
    <div className="h-full overflow-auto">
      <EventList filters={{searchQuery:"", category:"", selectedDate:null, maxDaysToEvent:30, showFreeOnly:false, useDistanceFilter:false, distanceRadius:5}} sortBy="date" sortAscending={true} />
    </div>
  );
};

export default function App() {
  const [isFilterOpen, setIsFilterOpen] = React.useState(false)
  const [isMapView, setIsMapView] = React.useState(true)
  const [eventCounts, setEventCounts] = React.useState<Record<string, number>>({})
  const [filters, setFilters] = React.useState<FilterState>({
    searchQuery: "",
    category: "",
    selectedDate: null,
    maxDaysToEvent: 30,
    showFreeOnly: false,
    useDistanceFilter: false,
    distanceRadius: 5
  })

  const toggleView = React.useCallback(() => {
    setIsMapView(prev => !prev);
  }, []);

  const handleFilterChange = React.useCallback((newFilters: Partial<FilterState>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters
    }));
  }, []);

  const handleSearch = React.useCallback((query: string) => {
    handleFilterChange({ searchQuery: query });
  }, [handleFilterChange]);

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
                {isMapView ? (
                  <MapView
                    filters={filters}
                    onFilterChange={handleFilterChange}
                  />
                ) : (
                  <div className="h-full overflow-auto">
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
                eventCounts={eventCounts}
                searchQuery={filters.searchQuery}
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