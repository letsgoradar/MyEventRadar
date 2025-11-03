import * as React from "react";
import AppLayout from "@/components/App/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { EventInterface } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserCheck } from "lucide-react";
import { Link } from "wouter";
import EventCard from "@/components/Events/EventCard";
import { useAuth } from "@/hooks/use-auth";
import { EventDetailPanel } from "@/components/App/EventDetailPanel";

export function AppMyEventsPage() {
  const { user } = useAuth();
  const [selectedEvent, setSelectedEvent] = React.useState<EventInterface | null>(null);
  
  // Query voor evenementen waar gebruiker zich voor heeft aangemeld
  const { data: myEvents = [], isLoading, error } = useQuery<EventInterface[]>({
    queryKey: [`/api/users/${user?.id}/participating-events`],
    enabled: !!user?.id,
  });

  const handleEventClick = React.useCallback((event: EventInterface) => {
    setSelectedEvent(event);
  }, []);

  const handleCloseEventDetail = React.useCallback(() => {
    setSelectedEvent(null);
  }, []);

  const handleNavigateEvent = React.useCallback((direction: 'previous' | 'next') => {
    if (!selectedEvent) return;
    
    const currentIndex = myEvents.findIndex(e => e.id === selectedEvent.id);
    if (direction === 'previous' && currentIndex > 0) {
      setSelectedEvent(myEvents[currentIndex - 1]);
    } else if (direction === 'next' && currentIndex < myEvents.length - 1) {
      setSelectedEvent(myEvents[currentIndex + 1]);
    }
  }, [selectedEvent, myEvents]);

  // Loading state
  const LoadingState = () => (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((n) => (
        <div key={n} className="h-32 bg-gray-200 rounded-md"></div>
      ))}
    </div>
  );

  // Empty state
  const EmptyState = () => (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-8">
        <UserCheck className="h-10 w-10 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold mb-2">Geen aanmeldingen</h2>
        <p className="text-muted-foreground mb-4 text-center">
          Je hebt je nog niet aangemeld voor evenementen.
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
      <AppLayout title="Mijn Aanmeldingen">
        <div className="pb-20">
          
          {isLoading ? (
            <LoadingState />
          ) : myEvents.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-4">
              {myEvents.map((event) => (
                <div key={event.id} onClick={() => handleEventClick(event)} className="cursor-pointer">
                  <EventCard event={event} />
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
          events={myEvents}
          onClose={handleCloseEventDetail}
          onPrevious={() => handleNavigateEvent('previous')}
          onNext={() => handleNavigateEvent('next')}
        />
      )}
    </>
  );
}

export default AppMyEventsPage;
