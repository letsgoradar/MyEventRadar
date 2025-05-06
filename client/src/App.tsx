import * as React from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from '@/components/ui/toaster'
import { Link, Route, Switch, useLocation, useParams } from "wouter"
import { AuthProvider } from "@/hooks/use-auth"
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
import type { EventInterface } from "@shared/schema"
import { queryClient } from "@/lib/queryClient"
// Webversie componenten
import CreateEvent from "@/pages/Web/create-event"
import EventDetail from "@/pages/Web/event-detail"
// App componenten (mobiele versie)
import AppHomePage from "@/pages/App"
import AppEventDetail from "@/pages/App/event-detail"
import { AppLoginPage } from "@/pages/App/login"
import { AppRegisterPage } from "@/pages/App/register"
import AppCreateEvent from "@/pages/App/create-event"
import AppEventsPage from "@/pages/App/events"
import AppFavoritesPage from "@/pages/App/favorites"
import AppProfilePage from "@/pages/App/profile"
import { AppWelcomePage } from "@/pages/App/welcome"
import AppForgotPasswordPage from "@/pages/App/forgot-password"

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
  const [filteredEvents, setFilteredEvents] = React.useState<EventInterface[]>([]);

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

  const handleFilteredEventsChange = React.useCallback((events: EventInterface[]) => {
    setFilteredEvents(events);
  }, []);

  // We kiezen de juiste interface op basis van het apparaat:
  // Desktop/tablet → Web interface
  // Mobiel → App interface
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
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
        
        {/* Mobiele Routes (App) */}
        {isMobile && (
          <>
            {/* Auth routes - deze moeten als eerste worden gedefinieerd */}
            <Route path="/app/welcome">
              <AppWelcomePage />
            </Route>
            <Route path="/app/login">
              <AppLoginPage />
            </Route>
            <Route path="/app/register">
              <AppRegisterPage />
            </Route>
            <Route path="/app/forgot-password">
              <AppForgotPasswordPage />
            </Route>
            
            {/* App specifieke routes */}
            <Route path="/app/create-event">
              <AppCreateEvent />
            </Route>
            <Route path="/app/event/:id">
              {(params) => <AppEventDetail />}
            </Route>
            <Route path="/app/events">
              <AppEventsPage />
            </Route>
            <Route path="/app/favorites">
              <AppFavoritesPage />
            </Route>
            <Route path="/app/profile">
              <AppProfilePage />
            </Route>
            <Route path="/app">
              <AppHomePage />
            </Route>
            
            {/* Oude App2 routes - redirecten naar App */}
            <Route path="/app2/welcome">
              <AppRedirect to="/app/welcome" />
            </Route>
            <Route path="/app2/login">
              <AppRedirect to="/app/login" />
            </Route>
            <Route path="/app2/register">
              <AppRedirect to="/app/register" />
            </Route>
            <Route path="/app2/forgot-password">
              <AppRedirect to="/app/forgot-password" />
            </Route>
            <Route path="/app2/create-event">
              <AppRedirect to="/app/create-event" />
            </Route>
            <Route path="/app2/event/:id">
              {({ id }) => <AppRedirect to={`/app/event/${id}`} />}
            </Route>
            <Route path="/app2/events">
              <AppRedirect to="/app/events" />
            </Route>
            <Route path="/app2/favorites">
              <AppRedirect to="/app/favorites" />
            </Route>
            <Route path="/app2/profile">
              <AppRedirect to="/app/profile" />
            </Route>
            <Route path="/app2">
              <AppRedirect to="/app" />
            </Route>
            
            {/* Basis routes - voor backwards compatibility */}
            <Route path="/create-event">
              <AppCreateEvent />
            </Route>
            <Route path="/event/:id">
              {(params) => <AppEventDetail />}
            </Route>
            <Route path="/events">
              <AppEventsPage />
            </Route>
            <Route path="/favorites">
              <AppFavoritesPage />
            </Route>
            <Route path="/profile">
              <AppProfilePage />
            </Route>
            <Route path="/login">
              <AppLoginPage />
            </Route>
            <Route path="/register">
              <AppRegisterPage />
            </Route>
            <Route path="/">
              <AppHomePage />
            </Route>
          </>
        )}
        
        {/* Fallback route voor onbekende routes */}
        <Route>
          {isMobile ? <AppHomePage /> : <WebPage />}
        </Route>
      </Switch>
      <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}