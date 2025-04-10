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
import WebLayout from "@/components/Layout/WebLayout"
import AdminDashboard from "@/pages/admin/Dashboard"
import AdminEvents from "@/pages/admin/Events"
import AdminUsers from "@/pages/admin/Users"
import ActivityLogs from "@/pages/admin/ActivityLogs"
import AdminLogin from "@/pages/admin/Login"
import AdminEventDetail from "@/pages/admin/EventDetail"
import AdminEventForm from "@/pages/admin/EventForm"
import AuthGuard from "@/components/Admin/AuthGuard"
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
          
          {/* Regular Routes using new WebLayout */}
          <Route path="/">
            <WebLayout />
          </Route>
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
              <div className="h-full overflow-auto p-4">
                <h1 className="text-2xl font-bold mb-6">Mijn Evenementen</h1>
                <p className="text-center py-12 text-muted-foreground">Hier vind je jouw evenementen.</p>
              </div>
            </WebLayout>
          </Route>
          <Route path="/favorites">
            <WebLayout>
              <div className="h-full overflow-auto p-4">
                <h1 className="text-2xl font-bold mb-6">Favorieten</h1>
                <p className="text-center py-12 text-muted-foreground">Deze functie is nog in ontwikkeling.</p>
              </div>
            </WebLayout>
          </Route>
          <Route path="/profile">
            <WebLayout>
              <div className="h-full overflow-auto p-4">
                <h1 className="text-2xl font-bold mb-6">Profiel</h1>
                <p className="text-center py-12 text-muted-foreground">Deze functie is nog in ontwikkeling.</p>
              </div>
            </WebLayout>
          </Route>
        </Switch>
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}