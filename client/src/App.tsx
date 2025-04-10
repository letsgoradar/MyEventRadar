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
import WebPage from "@/pages/Web"
import AdminDashboard from "@/pages/admin/Dashboard"
import AdminEvents from "@/pages/admin/Events"
import AdminUsers from "@/pages/admin/Users"
import ActivityLogs from "@/pages/admin/ActivityLogs"
import AdminLogin from "@/pages/admin/Login"
import AdminEventDetail from "@/pages/admin/EventDetail"
import AdminEventForm from "@/pages/admin/EventForm"
import AuthGuard from "@/components/Admin/AuthGuard"
import { WebLayout } from "@/components/Web/WebLayout"
import { useIsMobile } from "@/hooks/use-mobile"
import type { Event } from "@shared/schema"
import { queryClient } from "@/lib/queryClient"

export default function App() {
  const isMobile = useIsMobile();
  const [isMapView, setIsMapView] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [radius, setRadius] = React.useState(10);
  const [filteredEvents, setFilteredEvents] = React.useState<Event[]>([]);
  const [isWebVersion, setIsWebVersion] = React.useState(false);

  // Check if we should use the web version based on URL parameter
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('web') === 'true') {
      setIsWebVersion(true);
    }
  }, []);

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

  // If using web version and not on a mobile device, use the WebLayout
  if (isWebVersion && !isMobile) {
    return (
      <QueryClientProvider client={queryClient}>
        <Switch>
          {/* Admin Routes */}
          <Route path="/login">
            <AdminLogin />
          </Route>
          <Route path="/admin/login">
            <AdminLogin />
          </Route>
          <Route path="/admin">
            <AuthGuard>
              <AdminDashboard />
            </AuthGuard>
          </Route>
          <Route path="/admin/events">
            <AuthGuard>
              <AdminEvents />
            </AuthGuard>
          </Route>
          <Route path="/admin/users">
            <AuthGuard>
              <AdminUsers />
            </AuthGuard>
          </Route>
          <Route path="/admin/activity-logs">
            <AuthGuard>
              <ActivityLogs />
            </AuthGuard>
          </Route>
          <Route path="/admin/events/:id">
            <AuthGuard>
              <AdminEventDetail />
            </AuthGuard>
          </Route>
          <Route path="/admin/events/new">
            <AuthGuard>
              <AdminEventForm />
            </AuthGuard>
          </Route>
          <Route path="/admin/events/edit/:id">
            <AuthGuard>
              <AdminEventForm />
            </AuthGuard>
          </Route>
          
          {/* Web Version Routes with WebLayout */}
          <Route path="/create-event">
            <WebLayout>
              <CreateEventPage />
            </WebLayout>
          </Route>
          <Route path="/event/:id">
            <WebLayout>
              <EventDetailPage />
            </WebLayout>
          </Route>
          <Route path="/events">
            <WebLayout>
              <div className="p-6">
                <h1 className="text-2xl font-bold mb-6">Mijn Evenementen</h1>
                <p className="text-center py-12 text-muted-foreground">Hier vind je jouw evenementen.</p>
              </div>
            </WebLayout>
          </Route>
          <Route path="/favorites">
            <WebLayout>
              <div className="p-6">
                <h1 className="text-2xl font-bold mb-6">Favorieten</h1>
                <p className="text-center py-12 text-muted-foreground">Deze functie is nog in ontwikkeling.</p>
              </div>
            </WebLayout>
          </Route>
          <Route path="/profile">
            <WebLayout>
              <div className="p-6">
                <h1 className="text-2xl font-bold mb-6">Profiel</h1>
                <p className="text-center py-12 text-muted-foreground">Deze functie is nog in ontwikkeling.</p>
              </div>
            </WebLayout>
          </Route>
          <Route path="/">
            <WebPage />
          </Route>
        </Switch>
        <Toaster />
      </QueryClientProvider>
    );
  }

  // Original mobile version
  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-screen flex flex-col relative">
        <Switch>
          {/* Admin Routes */}
          <Route path="/login">
            <AdminLogin />
          </Route>
          <Route path="/admin/login">
            <AdminLogin />
          </Route>
          <Route path="/admin">
            <AuthGuard>
              <AdminDashboard />
            </AuthGuard>
          </Route>
          <Route path="/admin/events">
            <AuthGuard>
              <AdminEvents />
            </AuthGuard>
          </Route>
          <Route path="/admin/users">
            <AuthGuard>
              <AdminUsers />
            </AuthGuard>
          </Route>
          <Route path="/admin/activity-logs">
            <AuthGuard>
              <ActivityLogs />
            </AuthGuard>
          </Route>
          <Route path="/admin/events/:id">
            <AuthGuard>
              <AdminEventDetail />
            </AuthGuard>
          </Route>
          <Route path="/admin/events/new">
            <AuthGuard>
              <AdminEventForm />
            </AuthGuard>
          </Route>
          <Route path="/admin/events/edit/:id">
            <AuthGuard>
              <AdminEventForm />
            </AuthGuard>
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