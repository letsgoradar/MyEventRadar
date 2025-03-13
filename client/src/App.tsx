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

const queryClient = new QueryClient()

export default function App() {
  const [isMapView, setIsMapView] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [radius, setRadius] = React.useState(10);

  const toggleView = React.useCallback(() => {
    setIsMapView(prev => !prev);
  }, []);

  const handleSearch = React.useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleRadiusChange = React.useCallback((value: number) => {
    setRadius(value);
  }, []);

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
                radius={radius}
                onRadiusChange={handleRadiusChange}
              />
              <div className="absolute inset-0 top-[calc(3.5rem+3rem)] bottom-[75px] z-0">
                {isMapView ? (
                  <MapView searchQuery={searchQuery} radius={radius} />
                ) : (
                  <div className="h-full overflow-auto">
                    <EventList searchQuery={searchQuery} radius={radius} />
                  </div>
                )}
              </div>
              <BottomNav />
            </>
          </Route>
          <Route path="/events">
            <div className="h-screen flex flex-col relative">
              <TopNav />
              <div className="flex-1 overflow-auto p-4 pb-24 pt-[calc(3.5rem+3rem)]">
                <h1 className="text-2xl font-bold mb-6">Mijn Evenementen</h1>
                <p className="text-center py-12 text-muted-foreground">Hier vind je jouw evenementen.</p>
              </div>
              <BottomNav />
            </div>
          </Route>
          <Route path="/favorites">
            <div className="h-screen flex flex-col relative">
              <TopNav />
              <div className="flex-1 overflow-auto p-4 pb-24 pt-[calc(3.5rem+3rem)]">
                <h1 className="text-2xl font-bold mb-6">Favorieten</h1>
                <p className="text-center py-12 text-muted-foreground">Deze functie is nog in ontwikkeling.</p>
              </div>
              <BottomNav />
            </div>
          </Route>
          <Route path="/profile">
            <div className="h-screen flex flex-col relative">
              <TopNav />
              <div className="flex-1 overflow-auto p-4 pb-24 pt-[calc(3.5rem+3rem)]">
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