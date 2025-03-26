import * as React from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from '@/components/ui/toaster'
import { Link, Route, Switch } from "wouter"
import TopNav from "@/components/Layout/TopNav"
import MapView from "@/components/Map/MapView"
import { EventList } from "@/components/EventList"
import CreateEventPage from "@/pages/create-event"
import EventDetailPage from "@/pages/event-detail"
import BottomNav from "@/components/Layout/BottomNav"
import { AdminDashboard, AdminLogin } from "@/pages/admin"
import AdminAuthGuard from "@/components/Admin/AuthGuard"
import type { Event } from "@shared/schema"
import { queryClient } from "@/lib/queryClient"

export default function App() {
  const [isMapView, setIsMapView] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [radius, setRadius] = React.useState(10);
  const [filteredEvents, setFilteredEvents] = React.useState<Event[]>([]);

  const toggleView = React.useCallback(() => {
    setIsMapView(prev => !prev);
  }, []);

  const handleSearch = React.useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleRadiusChange = React.useCallback((value: number) => {
    setRadius(value);
  }, []);

  const handleFilteredEventsChange = React.useCallback((events: Event[]) => {
    setFilteredEvents(events);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-screen flex flex-col relative">
        <Switch>
          {/* Admin Routes */}
          <Route path="/admin/login">
            <AdminLogin />
          </Route>
          <Route path="/admin/dashboard">
            <AdminAuthGuard>
              <AdminDashboard />
            </AdminAuthGuard>
          </Route>
          
          {/* Regular Routes */}
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
                onFilteredEventsChange={handleFilteredEventsChange}
              />
              <div className="absolute inset-0 top-[calc(3.5rem+3rem)] bottom-[75px] z-0">
                {isMapView ? (
                  <MapView searchQuery={searchQuery} radius={radius} filteredEvents={filteredEvents} />
                ) : (
                  <div className="h-full overflow-auto pt-4">
                    <EventList searchQuery={searchQuery} radius={radius} filteredEvents={filteredEvents} />
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