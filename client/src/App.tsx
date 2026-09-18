import * as React from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from '@/components/ui/toaster'
import { Route, Switch } from "wouter"
import { AuthProvider } from "@/hooks/use-auth"
import { LanguageProvider } from "@/contexts/LanguageContext"
import AuthGuard from "@/components/Admin/AuthGuard"
import { useIsMobile } from "@/hooks/use-mobile"
import { useIsPWA } from "@/hooks/use-pwa"
import { queryClient } from "@/lib/queryClient"
import { ThemeInjector } from "@/components/ThemeInjector"
import { Skeleton } from "@/components/ui/skeleton"
import { BetaBanner } from "@/components/BetaBanner"
import { FeedbackWidget } from "@/components/FeedbackWidget"
import { CookieConsent } from "@/components/CookieConsent"
import { useAnalytics } from "@/hooks/useAnalytics"
import { useLocation } from "wouter"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw } from "lucide-react"

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

class RouteErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console so browser devtools / remote debugging can capture it
    console.error("[ErrorBoundary] Caught error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message ?? "";
      const stack = this.state.error?.stack ?? "";
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4 max-w-md p-8">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
            <h2 className="text-xl font-semibold">Er ging iets mis</h2>
            <p className="text-muted-foreground">
              De pagina kon niet geladen worden. Probeer het opnieuw.
            </p>
            {msg && (
              <details className="text-left text-xs text-muted-foreground bg-muted rounded-lg p-3 cursor-pointer">
                <summary className="font-medium select-none">Foutdetails (voor ondersteuning)</summary>
                <pre className="mt-2 whitespace-pre-wrap break-all">{msg}{"\n\n"}{stack}</pre>
              </details>
            )}
            <Button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Pagina herladen
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
const AdminVenues = React.lazy(() => import("@/pages/admin/Venues"));
const AdminVenueDetail = React.lazy(() => import("@/pages/admin/VenueDetail"));
const AdminFeedback = React.lazy(() => import("@/pages/admin/Feedback"));
const AdminSelfHeal = React.lazy(() => import("@/pages/admin/SelfHeal"));

const WebPage = React.lazy(() => import("@/pages/Web.tsx"));
const WebLoginPage = React.lazy(() => import("@/pages/Web/login"));
const WebRegisterPage = React.lazy(() => import("@/pages/Web/register"));
const WebWelcomePage = React.lazy(() => import("@/pages/Web/welcome"));
const WebProfilePage = React.lazy(() => import("@/pages/Web/ProfilePage"));
const CreateEvent = React.lazy(() => import("@/pages/Web/create-event"));
const EventDetail = React.lazy(() => import("@/pages/Web/event-detail"));
const WebMyEventsPage = React.lazy(() => import("@/pages/Web/my-events"));
const VenuePage = React.lazy(() => import("@/pages/Web/VenuePage"));
const VenueDashboard = React.lazy(() => import("@/pages/Web/VenueDashboard"));

const AppHomePage = React.lazy(() => import("@/pages/App/index"));
const AppLoginPage = React.lazy(() => import("@/pages/App/login"));
const AppRegisterPage = React.lazy(() => import("@/pages/App/register"));
const AppCreateEvent = React.lazy(() => import("@/pages/App/create-event"));
const AppEventsPage = React.lazy(() => import("@/pages/App/events"));
const AppMyEventsPage = React.lazy(() => import("@/pages/App/my-events"));
const AppProfilePage = React.lazy(() => import("@/pages/App/profile"));
const AppWelcomePage = React.lazy(() => import("@/pages/App/welcome"));
const AppForgotPasswordPage = React.lazy(() => import("@/pages/App/forgot-password"));
const AppEventDetailPage = React.lazy(() => import("@/pages/App/event-detail"));

const CityPage = React.lazy(() => import("@/pages/public/CityPage"));

const PrivacyPolicy = React.lazy(() => import("@/pages/PrivacyPolicy"));
const ResetPassword = React.lazy(() => import("@/pages/ResetPassword"));
const NotFound = React.lazy(() => import("@/pages/not-found"));
const ErrorPage = React.lazy(() => import("@/pages/error"));

const AdvertiserAuthGuard = React.lazy(() => import("@/components/Advertiser/AuthGuard"));
const AdvertiserLanding = React.lazy(() => import("@/pages/Advertiser/Landing"));
const AdvertiserRegister = React.lazy(() => import("@/pages/Advertiser/Register"));
const AdvertiserDashboard = React.lazy(() => import("@/pages/Advertiser/Dashboard"));
const AdvertiserAds = React.lazy(() => import("@/pages/Advertiser/Ads"));
const AdvertiserPromotions = React.lazy(() => import("@/pages/Advertiser/Promotions"));
const AdvertiserCampaigns = React.lazy(() => import("@/pages/Advertiser/Campaigns"));
const AdvertiserBilling = React.lazy(() => import("@/pages/Advertiser/Billing"));
const AdvertiserVerify = React.lazy(() => import("@/pages/Advertiser/Verify"));

const WebLayout = React.lazy(() => import("@/components/Web/WebLayout").then(m => ({ default: m.WebLayout })));

function AppRedirect({ to }: { to: string }) {
  React.useEffect(() => {
    window.location.href = to;
  }, [to]);
  
  return null;
}

export default function App() {
  const isMobile = useIsMobile();
  const isPWA = useIsPWA();

  const showInstallScreen = isMobile && !isPWA;

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <AnalyticsProvider>
          <ThemeInjector />
          <RouteErrorBoundary>
          <Switch>
        {/* Admin Routes */}
        <Route path="/login">
          <LazyLoad><AdminLogin /></LazyLoad>
        </Route>
        <Route path="/admin/login">
          <LazyLoad><AdminLogin /></LazyLoad>
        </Route>
        <Route path="/admin">
          <LazyLoad>
            <AuthGuard><AdminDashboard /></AuthGuard>
          </LazyLoad>
        </Route>
        <Route path="/admin/events">
          <LazyLoad>
            <AuthGuard><AdminEvents /></AuthGuard>
          </LazyLoad>
        </Route>
        <Route path="/admin/users">
          <LazyLoad>
            <AuthGuard><AdminUsers /></AuthGuard>
          </LazyLoad>
        </Route>
        <Route path="/admin/activity-logs">
          <LazyLoad>
            <AuthGuard><ActivityLogs /></AuthGuard>
          </LazyLoad>
        </Route>
        <Route path="/admin/rss-feeds">
          <LazyLoad>
            <AuthGuard><AdminRssFeeds /></AuthGuard>
          </LazyLoad>
        </Route>
        <Route path="/admin/tags">
          <LazyLoad>
            <AuthGuard><TagManager /></AuthGuard>
          </LazyLoad>
        </Route>
        <Route path="/admin/promotions">
          <LazyLoad>
            <AuthGuard><AdminPromotions /></AuthGuard>
          </LazyLoad>
        </Route>
        <Route path="/admin/feedback">
          <LazyLoad>
            <AuthGuard><AdminFeedback /></AuthGuard>
          </LazyLoad>
        </Route>
        <Route path="/admin/self-heal">
          <LazyLoad>
            <AuthGuard><AdminSelfHeal /></AuthGuard>
          </LazyLoad>
        </Route>
        <Route path="/admin/events/:id">
          <LazyLoad>
            <AuthGuard><AdminEventDetail /></AuthGuard>
          </LazyLoad>
        </Route>
        <Route path="/admin/events/new">
          <LazyLoad>
            <AuthGuard><AdminEventForm /></AuthGuard>
          </LazyLoad>
        </Route>
        <Route path="/admin/events/edit/:id">
          <LazyLoad>
            <AuthGuard><AdminEventForm /></AuthGuard>
          </LazyLoad>
        </Route>
        <Route path="/admin/venues">
          <LazyLoad>
            <AuthGuard><AdminVenues /></AuthGuard>
          </LazyLoad>
        </Route>
        <Route path="/admin/venues/:id">
          <LazyLoad>
            <AuthGuard><AdminVenueDetail /></AuthGuard>
          </LazyLoad>
        </Route>
        
        {/* Advertiser Routes */}
        <Route path="/adverteren">
          <LazyLoad><AdvertiserLanding /></LazyLoad>
        </Route>
        <Route path="/advertiser/register">
          <LazyLoad><AdvertiserRegister /></LazyLoad>
        </Route>
        <Route path="/advertiser/dashboard">
          <LazyLoad>
            <AdvertiserAuthGuard><AdvertiserDashboard /></AdvertiserAuthGuard>
          </LazyLoad>
        </Route>
        <Route path="/advertiser/ads">
          <LazyLoad>
            <AdvertiserAuthGuard><AdvertiserAds /></AdvertiserAuthGuard>
          </LazyLoad>
        </Route>
        <Route path="/advertiser/campaigns">
          <LazyLoad>
            <AdvertiserAuthGuard><AdvertiserCampaigns /></AdvertiserAuthGuard>
          </LazyLoad>
        </Route>
        <Route path="/advertiser/promotions">
          <LazyLoad>
            <AdvertiserAuthGuard><AdvertiserCampaigns /></AdvertiserAuthGuard>
          </LazyLoad>
        </Route>
        <Route path="/advertiser/billing">
          <LazyLoad>
            <AdvertiserAuthGuard><AdvertiserBilling /></AdvertiserAuthGuard>
          </LazyLoad>
        </Route>
        <Route path="/advertiser/verify">
          <LazyLoad><AdvertiserVerify /></LazyLoad>
        </Route>

        {/* Mobiel browser: toon install modal als overlay */}
        {showInstallScreen && (
          <>
            <Route path="/:province/:city/evenementen">
              <LazyLoad><CityPage /></LazyLoad>
            </Route>
            <Route path="/:province/:city">
              <LazyLoad><CityPage /></LazyLoad>
            </Route>
          </>
        )}

        {/* Web Login/Register/Welcome - beschikbaar op alle apparaten */}
        <Route path="/web/welcome">
          <LazyLoad><WebWelcomePage /></LazyLoad>
        </Route>
        <Route path="/web/login">
          <LazyLoad><WebLoginPage /></LazyLoad>
        </Route>
        <Route path="/web/register">
          <LazyLoad><WebRegisterPage /></LazyLoad>
        </Route>

        {/* Desktop Web Routes */}
        {!isMobile && (
          <>
            <Route path="/web/create-event">
              <LazyLoad><CreateEvent /></LazyLoad>
            </Route>
            <Route path="/web/edit-event/:id">
              <LazyLoad><CreateEvent /></LazyLoad>
            </Route>
            <Route path="/web/event/:id">
              <LazyLoad><EventDetail /></LazyLoad>
            </Route>
            <Route path="/web/events">
              <LazyLoad>
                <WebLayout>
                  <div className="p-6">
                    <h1 className="text-2xl font-bold mb-6">Mijn Evenementen</h1>
                    <p className="text-center py-12 text-muted-foreground">Hier vind je jouw evenementen.</p>
                  </div>
                </WebLayout>
              </LazyLoad>
            </Route>
            <Route path="/web/my-events">
              <LazyLoad><WebMyEventsPage /></LazyLoad>
            </Route>
            <Route path="/web/saved">
              <LazyLoad><WebMyEventsPage /></LazyLoad>
            </Route>
            <Route path="/web/favorites">
              <LazyLoad><WebMyEventsPage /></LazyLoad>
            </Route>
            <Route path="/web/profile">
              <LazyLoad><WebProfilePage /></LazyLoad>
            </Route>
            <Route path="/web">
              <LazyLoad><WebPage /></LazyLoad>
            </Route>
            
            {/* Backwards compatibility */}
            <Route path="/create-event">
              <LazyLoad><CreateEvent /></LazyLoad>
            </Route>
            <Route path="/event/:id">
              <LazyLoad><EventDetail /></LazyLoad>
            </Route>
            <Route path="/events">
              <LazyLoad>
                <WebLayout>
                  <div className="p-6">
                    <h1 className="text-2xl font-bold mb-6">Mijn Evenementen</h1>
                    <p className="text-center py-12 text-muted-foreground">Hier vind je jouw evenementen.</p>
                  </div>
                </WebLayout>
              </LazyLoad>
            </Route>
            <Route path="/saved">
              <LazyLoad><WebMyEventsPage /></LazyLoad>
            </Route>
            <Route path="/favorites">
              <LazyLoad><WebMyEventsPage /></LazyLoad>
            </Route>
            <Route path="/my-events">
              <LazyLoad><WebMyEventsPage /></LazyLoad>
            </Route>
            <Route path="/profile">
              <LazyLoad><WebProfilePage /></LazyLoad>
            </Route>
            <Route path="/venue/:id">
              <LazyLoad><VenuePage /></LazyLoad>
            </Route>
            <Route path="/venue/:id/dashboard">
              <LazyLoad><VenueDashboard /></LazyLoad>
            </Route>
            
            {/* Default routes voor desktop */}
            <Route path="/">
              <LazyLoad><WebPage /></LazyLoad>
            </Route>
          </>
        )}
        
        {/* App Routes */}
        <Route path="/app/welcome">
          <LazyLoad><AppWelcomePage /></LazyLoad>
        </Route>
        <Route path="/app/login">
          <LazyLoad><AppLoginPage /></LazyLoad>
        </Route>
        <Route path="/app/register">
          <LazyLoad><AppRegisterPage /></LazyLoad>
        </Route>
        <Route path="/app/forgot-password">
          <LazyLoad><AppForgotPasswordPage /></LazyLoad>
        </Route>
        <Route path="/app/create-event">
          <LazyLoad><AppCreateEvent /></LazyLoad>
        </Route>
        <Route path="/app/edit-event/:id">
          <LazyLoad><AppCreateEvent /></LazyLoad>
        </Route>
        <Route path="/app/event/:id">
          <LazyLoad><AppEventDetailPage /></LazyLoad>
        </Route>
        <Route path="/app/my-events">
          <LazyLoad><AppMyEventsPage /></LazyLoad>
        </Route>
        <Route path="/app/saved">
          <LazyLoad><AppMyEventsPage /></LazyLoad>
        </Route>
        <Route path="/app/favorites">
          <LazyLoad><AppMyEventsPage /></LazyLoad>
        </Route>
        <Route path="/app/events">
          <LazyLoad><AppEventsPage /></LazyLoad>
        </Route>
        <Route path="/app/profile">
          <LazyLoad><AppProfilePage /></LazyLoad>
        </Route>
        <Route path="/app">
          <LazyLoad><AppHomePage /></LazyLoad>
        </Route>

        {/* Privacy Policy */}
        <Route path="/privacy">
          <LazyLoad><PrivacyPolicy /></LazyLoad>
        </Route>

        {/* Password Reset */}
        <Route path="/reset-password/:token">
          <LazyLoad><ResetPassword /></LazyLoad>
        </Route>

        {/* Public SEO Routes — must come after specific routes */}
        <Route path="/:province/:city/evenementen">
          <LazyLoad><CityPage /></LazyLoad>
        </Route>
        <Route path="/:province/:city">
          <LazyLoad><CityPage /></LazyLoad>
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
          <LazyLoad>
            {isMobile ? <AppHomePage /> : <WebPage />}
          </LazyLoad>
        </Route>
        
        {/* Error route */}
        <Route path="/error">
          <LazyLoad><ErrorPage /></LazyLoad>
        </Route>
        
        {/* 404 fallback */}
        <Route>
          <LazyLoad><NotFound /></LazyLoad>
        </Route>
          </Switch>
          </RouteErrorBoundary>
          <BetaOverlay />
          <Toaster />
          </AnalyticsProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useAnalytics();
  return <>{children}</>;
}

function BetaOverlay() {
  const [location] = useLocation();
  const isAdmin = location.startsWith("/admin") || location === "/login";
  if (isAdmin) return null;
  return (
    <>
      <BetaBanner />
      <FeedbackWidget />
      <CookieConsent />
    </>
  );
}
