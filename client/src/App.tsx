import * as React from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from '@/components/ui/toaster'
import { Link, Route, Switch, useLocation, useParams } from "wouter"
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
import ModeToggle from "@/components/Web/ModeToggle"
import type { Event } from "@shared/schema"
import { queryClient } from "@/lib/queryClient"
// Webversie componenten
import CreateEvent from "@/pages/Web/create-event"
import EventDetail from "@/pages/Web/event-detail"
// App2 componenten (nieuwe mobiele versie)
import App2HomePage from "@/pages/App2"
import App2EventDetail from "@/pages/App2/event-detail"
import App2CreateEvent from "@/pages/App2/create-event"
import App2EventsPage from "@/pages/App2/events"
import App2FavoritesPage from "@/pages/App2/favorites"
import App2ProfilePage from "@/pages/App2/profile"

// Helper component voor redirects
function AppRedirect({ to }: { to: string }) {
  React.useEffect(() => {
    window.location.href = to;
  }, [to]);
  
  return null;
}

export default function App() {
  const isMobile = useIsMobile();
  const [isMapView, setIsMapView] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [radius, setRadius] = React.useState(10);
  const [filteredEvents, setFilteredEvents] = React.useState<Event[]>([]);
  const [isWebVersion, setIsWebVersion] = React.useState(false);

  // Check for URL path to determine interface type and redirect if needed
  React.useEffect(() => {
    const path = window.location.pathname;
    
    // Set web version based on URL path
    if (path.startsWith('/web')) {
      setIsWebVersion(true);
      localStorage.setItem('useWebVersion', 'true');
    } else if (path.startsWith('/app')) {
      setIsWebVersion(false);
      localStorage.setItem('useWebVersion', 'false');
    } else if (path === '/') {
      // Redirect home page to /web or /app based on user preference or device
      const storedPref = localStorage.getItem('useWebVersion');
      if (storedPref === 'true' || (!storedPref && !isMobile)) {
        window.location.href = '/web';
      } else {
        window.location.href = '/app';
      }
    } else if (!path.startsWith('/admin')) {
      // For other paths that don't start with /web, /app, or /admin, check localStorage
      const storedPref = localStorage.getItem('useWebVersion');
      if (storedPref === 'true') {
        setIsWebVersion(true);
      }
    }
    
    console.log('Web version enabled:', path.startsWith('/web') || localStorage.getItem('useWebVersion') === 'true');
  }, [isMobile]);

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
          
          {/* Web Version Routes - both /web prefix and direct routes */}
          <Route path="/web/create-event">
            <CreateEvent />
          </Route>
          <Route path="/web/event/:id">
            <EventDetail />
          </Route>
          <Route path="/web/events">
            <WebLayout>
              <div className="p-6">
                <h1 className="text-2xl font-bold mb-6">Mijn Evenementen</h1>
                <p className="text-center py-12 text-muted-foreground">Hier vind je jouw evenementen.</p>
              </div>
            </WebLayout>
          </Route>
          <Route path="/web/favorites">
            <WebLayout>
              <div className="p-6">
                <h1 className="text-2xl font-bold mb-6">Favorieten</h1>
                <p className="text-center py-12 text-muted-foreground">Deze functie is nog in ontwikkeling.</p>
              </div>
            </WebLayout>
          </Route>
          <Route path="/web/profile">
            <WebLayout>
              <div className="p-6">
                <h1 className="text-2xl font-bold mb-6">Profiel</h1>
                <p className="text-center py-12 text-muted-foreground">Deze functie is nog in ontwikkeling.</p>
              </div>
            </WebLayout>
          </Route>
          <Route path="/web">
            <WebPage />
          </Route>
          
          {/* Default Web Routes - for backwards compatibility */}
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
        <ModeToggle />
      </QueryClientProvider>
    );
  }

  // If we're on a mobile device (small screen), we'll show App2 (enhanced mobile experience)
  // This automatically activates the new enhanced mobile experience on small screens
  if (isMobile) {
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
          
          {/* App2 Routes - Enhanced Mobile Experience */}
          <Route path="/app2/create-event">
            <App2CreateEvent />
          </Route>
          <Route path="/app2/event/:id">
            <App2EventDetail />
          </Route>
          <Route path="/app2/events">
            <App2EventsPage />
          </Route>
          <Route path="/app2/favorites">
            <App2FavoritesPage />
          </Route>
          <Route path="/app2/profile">
            <App2ProfilePage />
          </Route>
          <Route path="/app2">
            <App2HomePage />
          </Route>
          
          {/* Original App Routes - we redirect these to App2 */}
          <Route path="/app/create-event">
            <AppRedirect to="/app2/create-event" />
          </Route>
          <Route path="/app/event/:id">
            {({ id }) => <AppRedirect to={`/app2/event/${id}`} />}
          </Route>
          <Route path="/app/events">
            <AppRedirect to="/app2/events" />
          </Route>
          <Route path="/app/favorites">
            <AppRedirect to="/app2/favorites" />
          </Route>
          <Route path="/app/profile">
            <AppRedirect to="/app2/profile" />
          </Route>
          <Route path="/app">
            <AppRedirect to="/app2" />
          </Route>
          
          {/* Legacy routes - for backwards compatibility */}
          <Route path="/create-event">
            <App2CreateEvent />
          </Route>
          <Route path="/event/:id">
            {(params) => <App2EventDetail />}
          </Route>
          <Route path="/events">
            <App2EventsPage />
          </Route>
          <Route path="/favorites">
            <App2FavoritesPage />
          </Route>
          <Route path="/profile">
            <App2ProfilePage />
          </Route>
          <Route path="/">
            <App2HomePage />
          </Route>
        </Switch>
        <Toaster />
      </QueryClientProvider>
    );
  }
  
  // Original mobile version (fallback for larger screens that don't get the web experience)
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
          
          {/* Mobile App Routes with /app prefix */}
          <Route path="/app/create-event">
            <CreateEventPage />
          </Route>
          <Route path="/app/event/:id">
            <EventDetailPage />
          </Route>
          <Route path="/app">
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
          <Route path="/app/events">
            <div className="h-screen flex flex-col relative">
              <TopNav />
              <div className="flex-1 overflow-auto p-4 pb-24 pt-[calc(3.5rem+3rem)]">
                <h1 className="text-2xl font-bold mb-6">Mijn Evenementen</h1>
                <p className="text-center py-12 text-muted-foreground">Hier vind je jouw evenementen.</p>
              </div>
              <BottomNav />
            </div>
          </Route>
          <Route path="/app/favorites">
            <div className="h-screen flex flex-col relative">
              <TopNav />
              <div className="flex-1 overflow-auto p-4 pb-24 pt-[calc(3.5rem+3rem)]">
                <h1 className="text-2xl font-bold mb-6">Favorieten</h1>
                <p className="text-center py-12 text-muted-foreground">Deze functie is nog in ontwikkeling.</p>
              </div>
              <BottomNav />
            </div>
          </Route>
          <Route path="/app/profile">
            <div className="h-screen flex flex-col relative">
              <TopNav />
              <div className="flex-1 overflow-auto p-4 pb-24 pt-[calc(3.5rem+3rem)]">
                <h1 className="text-2xl font-bold mb-6">Profiel</h1>
                <p className="text-center py-12 text-muted-foreground">Deze functie is nog in ontwikkeling.</p>
              </div>
              <BottomNav />
            </div>
          </Route>

          {/* Legacy routes - for backwards compatibility */}
          <Route path="/create-event">
            <CreateEventPage />
          </Route>
          <Route path="/event/:id">
            <EventDetailPage />
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
        </Switch>
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}