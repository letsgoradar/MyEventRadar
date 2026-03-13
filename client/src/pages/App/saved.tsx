import * as React from "react";
import AppLayout from "@/components/App/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { EventInterface } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, UserCheck } from "lucide-react";
import { Link } from "wouter";
import EventCard from "@/components/Events/EventCard";
import { useAuth } from "@/hooks/use-auth";
import { EventDetailPanel } from "@/components/App/EventDetailPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AppSavedPage() {
  const { user } = useAuth();
  const [selectedEvent, setSelectedEvent] = React.useState<EventInterface | null>(null);
  const [activeTab, setActiveTab] = React.useState<string>("all");
  
  // Query voor favoriete evenementen
  const { data: favoriteEvents = [], isLoading: loadingFavorites } = useQuery<EventInterface[]>({
    queryKey: ['/api/events/favorites'],
    enabled: !!user,
  });

  // Query voor evenementen waar gebruiker zich voor heeft aangemeld
  const { data: participatingEvents = [], isLoading: loadingParticipating } = useQuery<EventInterface[]>({
    queryKey: [`/api/events/participation/${user?.id}`],
    enabled: !!user?.id,
  });

  const isLoading = loadingFavorites || loadingParticipating;

  // Combineer beide lijsten en verwijder duplicaten
  const allEvents = React.useMemo(() => {
    const combined = [...favoriteEvents, ...participatingEvents];
    const unique = Array.from(new Map(combined.map(e => [e.id, e])).values());
    return unique;
  }, [favoriteEvents, participatingEvents]);

  const displayEvents = React.useMemo(() => {
    if (activeTab === "saved") return favoriteEvents;
    if (activeTab === "participating") return participatingEvents;
    return allEvents;
  }, [activeTab, favoriteEvents, participatingEvents, allEvents]);

  const handleEventClick = React.useCallback((event: EventInterface) => {
    setSelectedEvent(event);
  }, []);

  const handleCloseEventDetail = React.useCallback(() => {
    setSelectedEvent(null);
  }, []);

  const handleNavigateEvent = React.useCallback((direction: 'previous' | 'next') => {
    if (!selectedEvent) return;
    
    const currentIndex = displayEvents.findIndex(e => e.id === selectedEvent.id);
    if (direction === 'previous' && currentIndex > 0) {
      setSelectedEvent(displayEvents[currentIndex - 1]);
    } else if (direction === 'next' && currentIndex < displayEvents.length - 1) {
      setSelectedEvent(displayEvents[currentIndex + 1]);
    }
  }, [selectedEvent, displayEvents]);

  // Loading state
  const LoadingState = () => (
    <div className="space-y-3 px-4">
      {[1, 2, 3].map((n) => (
        <div key={n} className="h-24 bg-gray-200 rounded-lg animate-pulse"></div>
      ))}
    </div>
  );

  // Empty state
  const EmptyState = () => (
    <Card className="mx-4 mt-4">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Heart className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold mb-2">Geen opgeslagen events</h2>
        <p className="text-muted-foreground mb-4 text-center text-sm px-4">
          Sla events op of meld je aan om ze hier terug te vinden.
        </p>
        <Button asChild>
          <Link href="/app">
            Ontdek evenementen
          </Link>
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <>
      <AppLayout title="Opgeslagen" hideViewToggle={true} defaultView="list" hideSearchAndFilters={true}>
        <div className="pb-20">
          {/* Tabs voor filtering */}
          <div className="sticky top-0 bg-background z-10 border-b">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-3 h-12 rounded-none">
                <TabsTrigger value="all" className="text-xs">
                  Alle ({allEvents.length})
                </TabsTrigger>
                <TabsTrigger value="saved" className="text-xs">
                  <Heart className="h-3.5 w-3.5 mr-1" />
                  Opgeslagen ({favoriteEvents.length})
                </TabsTrigger>
                <TabsTrigger value="participating" className="text-xs">
                  <UserCheck className="h-3.5 w-3.5 mr-1" />
                  Aangemeld ({participatingEvents.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          {isLoading ? (
            <LoadingState />
          ) : displayEvents.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-2 px-4 pt-3">
              {displayEvents.map((event) => (
                <div 
                  key={event.id} 
                  onClick={() => handleEventClick(event)} 
                  className="cursor-pointer"
                >
                  <EventCard event={event} gridView={false} onEventClick={handleEventClick} />
                </div>
              ))}
            </div>
          )}
        </div>
      </AppLayout>
      
      {/* Event Detail Overlay */}
      {selectedEvent && (
        <EventDetailPanel
          event={selectedEvent}
          events={displayEvents}
          onClose={handleCloseEventDetail}
          onPrevious={() => handleNavigateEvent('previous')}
          onNext={() => handleNavigateEvent('next')}
        />
      )}
    </>
  );
}

export default AppSavedPage;
