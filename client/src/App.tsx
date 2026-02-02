import * as React from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from '@/components/ui/toaster'
import { Route, Switch } from "wouter"
import { AuthProvider } from "@/hooks/use-auth"
import { LanguageProvider } from "@/contexts/LanguageContext"
import AuthGuard from "@/components/Admin/AuthGuard"
import { useIsMobile } from "@/hooks/use-mobile"
import { queryClient } from "@/lib/queryClient"
import { ThemeInjector } from "@/components/ThemeInjector"
import { Skeleton } from "@/components/ui/skeleton"

// Lazy loading wrapper voor betere code splitting
const LazyLoad = ({ children }: { children: React.ReactNode }) => (
  <React.Suspense fallback={
    <div className="flex items-center justify-center min-h-screen">
      <div className="space-y-4 w-full max-w-md p-8">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  }>
    {children}
  </React.Suspense>
);

// Admin componenten (lazy loaded)
const AdminLogin = React.lazy(() => import("@/pages/admin/Login"));
const AdminDashboard = React.lazy(() => import("@/pages/admin/Dashboard"));
const AdminEvents = React.lazy(() => import("@/pages/admin/Events"));
const AdminUsers = React.lazy(() => import("@/pages/admin/Users"));
const ActivityLogs = React.lazy(() => import("@/pages/admin/ActivityLogs"));
const AdminEventDetail = React.lazy(() => import("@/pages/admin/EventDetail"));
const AdminEventForm = React.lazy(() => import("@/pages/admin/EventForm"));
const AdminRssFeeds = React.lazy(() => import("@/pages/admin/RssFeeds"));
const TagManager = React.lazy(() => import("@/pages/admin/TagManager"));
const AdminPromotions = React.lazy(() => import("@/pages/admin/Promotions"));

// Web componenten (lazy loaded) - Let op: Web.tsx is direct in pages, niet in Web/
const WebPage = React.lazy(() => import("@/pages/Web.tsx"));
const WebProfilePage = React.lazy(() => import("@/pages/Web/ProfilePage"));
const CreateEvent = React.lazy(() => import("@/pages/Web/create-event"));
const EventDetail = React.lazy(() => import("@/pages/Web/event-detail"));
const WebMyEventsPage = React.lazy(() => import("@/pages/Web/my-events"));
const VenuePage = React.lazy(() => import("@/pages/Web/VenuePage"));
const VenueDashboard = React.lazy(() => import("@/pages/Web/VenueDashboard"));

// App componenten (lazy loaded)
const AppHomePage = React.lazy(() => import("@/pages/App/index"));
const AppLoginPage = React.lazy(() => import("@/pages/App/login"));
const AppRegisterPage = React.lazy(() => import("@/pages/App/register"));
const AppCreateEvent = React.lazy(() => import("@/pages/App/create-event"));
const AppEventsPage = React.lazy(() => import("@/pages/App/events"));
const AppMyEventsPage = React.lazy(() => import("@/pages/App/my-events"));
const AppProfilePage = React.lazy(() => import("@/pages/App/profile"));
const AppWelcomePage = React.lazy(() => import("@/pages/App/welcome"));
const AppForgotPasswordPage = React.lazy(() => import("@/pages/App/forgot-password"));

// Public SEO pagina's (lazy loaded)
const CityPage = React.lazy(() => import("@/pages/public/CityPage"));

// Layout componenten
const WebLayout = React.lazy(() => import("@/components/Web/WebLayout").then(m => ({ default: m.WebLayout })));

// Helper component voor redirects
function AppRedirect({ to }: { to: string }) {
  React.useEffect(() => {
    window.location.href = to;
  }, [to]);
  
  return null;
}

export default function App() {
  const isMobile = useIsMobile();

  // We kiezen de juiste interface op basis van het apparaat:
  // Desktop/tablet → Web interface
  // Mobiel → App interface
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <ThemeInjector />
          <LazyLoad>
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
        <Route path="/admin/rss-feeds">
          <AuthGuard>
            <AdminRssFeeds />
          </AuthGuard>
        </Route>
        <Route path="/admin/tags">
          <AuthGuard>
            <TagManager />
          </AuthGuard>
        </Route>
        <Route path="/admin/promotions">
          <AuthGuard>
            <AdminPromotions />
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
            <Route path="/web/edit-event/:id">
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
            <Route path="/web/my-events">
              <WebMyEventsPage />
            </Route>
            <Route path="/web/saved">
              <WebMyEventsPage />
            </Route>
            <Route path="/web/favorites">
              <WebMyEventsPage />
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
            <Route path="/saved">
              <WebMyEventsPage />
            </Route>
            <Route path="/favorites">
              <WebMyEventsPage />
            </Route>
            <Route path="/my-events">
              <WebMyEventsPage />
            </Route>
            <Route path="/profile">
              <WebProfilePage />
            </Route>
            <Route path="/venue/:id">
              <VenuePage />
            </Route>
            <Route path="/venue/:id/dashboard">
              <VenueDashboard />
            </Route>
            
            {/* Default routes voor desktop */}
            <Route path="/">
              <WebPage />
            </Route>
          </>
        )}
        
        {/* App Routes - altijd beschikbaar, ongeacht apparaat type */}
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
        <Route path="/app/create-event">
          <AppCreateEvent />
        </Route>
        <Route path="/app/edit-event/:id">
          <AppCreateEvent />
        </Route>
        <Route path="/app/event/:id">
          {() => {
            // Redirect oude event detail route naar homepage
            // Events worden nu getoond via EventDetailPanel overlay
            window.location.href = '/app';
            return null;
          }}
        </Route>
        <Route path="/app/my-events">
          <AppMyEventsPage />
        </Route>
        <Route path="/app/saved">
          <AppMyEventsPage />
        </Route>
        <Route path="/app/favorites">
          <AppMyEventsPage />
        </Route>
        <Route path="/app/events">
          <AppEventsPage />
        </Route>
        <Route path="/app/profile">
          <AppProfilePage />
        </Route>
        <Route path="/app">
          <AppHomePage />
        </Route>

        {/* Public SEO Routes - stadspagina's */}
        <Route path="/:province/:city/evenementen">
          <CityPage />
        </Route>
        <Route path="/:province/:city">
          <CityPage />
        </Route>

        {/* Theme preview route */}
        <Route path="/theme-preview">
          {() => {
            const ThemePreview = React.lazy(() => import("@/pages/ThemePreview"));
            return (
              <React.Suspense fallback={<div>Laden...</div>}>
                <ThemePreview />
              </React.Suspense>
            );
          }}
        </Route>

        {/* Default route */}
        <Route path="/">
          {isMobile ? <AppHomePage /> : <WebPage />}
        </Route>
        
        {/* Fallback route voor onbekende routes */}
        <Route>
          {isMobile ? <AppHomePage /> : <WebPage />}
        </Route>
          </Switch>
          </LazyLoad>
          <Toaster />
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}