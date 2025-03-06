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
import { QuickFilters } from "@/components/QuickFilters"

const queryClient = new QueryClient()

interface FilterState {
  searchQuery: string;
  category: string;
  maxDaysToEvent: number;
  showFreeOnly: boolean;
  eventCounts: Record<string, number>;
}

export default function App() {
  const [isMapView, setIsMapView] = React.useState(true)
  const [filters, setFilters] = React.useState<FilterState>({
    searchQuery: "",
    category: "all",
    maxDaysToEvent: 30,
    showFreeOnly: false,
    eventCounts: {}
  });

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
                onSearch={handleSearch}
              />
              <div className="absolute inset-0 top-14 bottom-[75px] z-0"> 
                {/* QuickFilters positioned above both views */}
                <div className="absolute top-4 right-4 z-[1000]">
                  <QuickFilters
                    selectedCategory={filters.category}
                    showFreeOnly={filters.showFreeOnly}
                    maxDaysToEvent={filters.maxDaysToEvent}
                    searchQuery={filters.searchQuery}
                    onFilterChange={handleFilterChange}
                    eventCounts={filters.eventCounts}
                    position="right"
                  />
                </div>

                {isMapView ? (
                  <MapView
                    filters={filters}
                    onFilterChange={handleFilterChange}
                  />
                ) : (
                  <div className="h-full overflow-auto">
                    <EventList
                      filters={filters}
                      onFilterChange={handleFilterChange}
                    />
                  </div>
                )}
              </div>
              <BottomNav />
            </>
          </Route>
          <Route path="/events">
            <div className="h-screen flex flex-col relative">
              <TopNav />
              <div className="flex-1 overflow-auto p-4 pb-24">
                <h1 className="text-2xl font-bold mb-6">Mijn Evenementen</h1>
                <p className="text-center py-12 text-muted-foreground">Hier vind je jouw evenementen.</p>
              </div>
              <BottomNav />
            </div>
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