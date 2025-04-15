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
import WebProfilePage from "@/pages/Web/ProfilePage"
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
import App2LoginPage from "@/pages/App2/login"
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

  // Log information for debugging
  React.useEffect(() => {
    console.log("Got user location:", 51.77344, 5.5345152);
    console.log("Web version enabled:", !isMobile);
    
    // Test API verbinding voor nabije evenementen
    if (navigator.geolocation) {
      const params = { lat: 51.77344, lng: 5.5345152, radius: 10 };
      console.log("Fetching events with params:", params);
      console.log("Making API request to: /api/events/nearby?lat=51.77344&lng=5.5345152&radius=10");
      
      fetch(`/api/events/nearby?lat=${params.lat}&lng=${params.lng}&radius=${params.radius}`)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          console.log("API response successful:", data);
          setFilteredEvents(data);
        })
        .catch(error => {
          console.error("API request error:", error);
        });
    }
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

  // We kiezen de juiste interface op basis van het apparaat:
  // Desktop/tablet → Web interface
  // Mobiel → App2 interface
  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        {/* Admin Routes - beschikbaar op alle apparaten */}
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
        
        {/* Desktop Web Routes */}
        {!isMobile && (
          <>
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
              <WebProfilePage />
            </Route>
            <Route path="/web">
              <WebPage />
            </Route>
            
            {/* Backwards compatibility: reguliere routes verwijzen naar web versie voor desktop */}
            <Route path="/create-event">
              <CreateEvent />
            </Route>
            <Route path="/event/:id">
              <EventDetail />
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
              <WebProfilePage />
            </Route>
            
            {/* Default routes voor desktop */}
            <Route path="/">
              <WebPage />
            </Route>
          </>
        )}
        
        {/* Mobiele Routes (App2) */}
        {isMobile && (
          <>
            {/* App2 specifieke routes */}
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
            <Route path="/app2/login">
              <App2LoginPage />
            </Route>
            <Route path="/app2">
              <App2HomePage />
            </Route>
            
            {/* Originele app routes - redirecten naar App2 */}
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
            
            {/* Basis routes - voor backwards compatibility */}
            <Route path="/create-event">
              <App2CreateEvent />
            </Route>
            <Route path="/event/:id">
              <App2EventDetail />
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
            <Route path="/login">
              <App2LoginPage />
            </Route>
            <Route path="/">
              <App2HomePage />
            </Route>
          </>
        )}
        
        {/* Fallback route voor onbekende routes */}
        <Route>
          {isMobile ? <App2HomePage /> : <WebPage />}
        </Route>
      </Switch>
      <Toaster />
      {!isMobile && <ModeToggle />}
    </QueryClientProvider>
  );
}