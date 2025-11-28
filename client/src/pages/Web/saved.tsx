import * as React from "react";
import WebLayout from "@/components/Web/WebLayout";
import { useQuery } from "@tanstack/react-query";
import { EventInterface } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bookmark, UserCheck, Calendar, MapPin, Clock } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { getSmartImage } from "@/lib/smartImageSelection";
import { EventDetailPanel } from "@/components/Web/EventDetailPanel";

export function WebSavedPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = React.useState<string>("all");
  const [selectedEvent, setSelectedEvent] = React.useState<EventInterface | null>(null);
  
  const { data: favoriteEvents = [], isLoading: loadingFavorites } = useQuery<EventInterface[]>({
    queryKey: ['/api/events/favorites'],
    enabled: !!user,
  });

  const { data: participatingEvents = [], isLoading: loadingParticipating } = useQuery<EventInterface[]>({
    queryKey: [`/api/events/participation/${user?.id}`],
    enabled: !!user?.id,
  });

  const isLoading = loadingFavorites || loadingParticipating;

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

  const isSaved = (eventId: number) => favoriteEvents.some(e => e.id === eventId);
  const isParticipating = (eventId: number) => participatingEvents.some(e => e.id === eventId);

  const formatEventDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return format(date, "EEEE d MMMM yyyy", { locale: nl });
  };

  const formatEventTime = (dateString: string | Date) => {
    const date = new Date(dateString);
    return format(date, "HH:mm", { locale: nl });
  };

  const LoadingState = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <div key={n} className="h-64 bg-muted rounded-lg animate-pulse"></div>
      ))}
    </div>
  );

  const EmptyState = () => (
    <Card className="mt-8">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <Bookmark className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">Geen opgeslagen evenementen</h2>
        <p className="text-muted-foreground mb-6 text-center max-w-md">
          Je hebt nog geen evenementen opgeslagen of je bent nog niet aangemeld voor evenementen.
        </p>
        <Button asChild size="lg">
          <Link href="/web">
            Ontdek evenementen
          </Link>
        </Button>
      </CardContent>
    </Card>
  );

  const EventCard = ({ event }: { event: EventInterface }) => {
    const saved = isSaved(event.id);
    const participating = isParticipating(event.id);
    
    return (
      <Card 
        className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
        onClick={() => handleEventClick(event)}
        data-testid={`card-event-${event.id}`}
      >
        <div className="relative h-40 overflow-hidden">
          <img 
            src={event.imageUrl || getSmartImage(event.title || '', event.description || '').image || 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=400&h=300&fit=crop'}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              e.currentTarget.src = 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=400&h=300&fit=crop';
            }}
          />
          <div className="absolute top-2 right-2 flex gap-1">
            {saved && (
              <div className="bg-primary text-primary-foreground rounded-full p-1.5" title="Opgeslagen">
                <Bookmark className="h-4 w-4 fill-current" />
              </div>
            )}
            {participating && (
              <div className="bg-green-500 text-white rounded-full p-1.5" title="Aangemeld">
                <UserCheck className="h-4 w-4" />
              </div>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
            <span className="text-xs font-medium text-white/90 bg-white/20 px-2 py-0.5 rounded">
              {event.category}
            </span>
          </div>
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold text-lg mb-2 line-clamp-1">{event.title}</h3>
          <div className="space-y-1.5 text-sm text-muted-foreground">
            {event.startTime && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <span className="line-clamp-1">{formatEventDate(event.startTime)}</span>
              </div>
            )}
            {event.startTime && event.endTime && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 flex-shrink-0" />
                <span>{formatEventTime(event.startTime)} - {formatEventTime(event.endTime)}</span>
              </div>
            )}
            {event.address && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span className="line-clamp-1">{event.address}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <WebLayout>
        <div className="flex h-full">
          {/* Event List Section */}
          <div className={`${selectedEvent ? 'w-1/2' : 'w-full'} transition-all duration-300 overflow-auto`}>
            <div className="p-6 max-w-7xl mx-auto">
              <div className="mb-6">
                <h1 className="text-3xl font-bold mb-2">Opgeslagen Evenementen</h1>
                <p className="text-muted-foreground">
                  Bekijk je opgeslagen evenementen en evenementen waarvoor je je hebt aangemeld.
                </p>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
                <TabsList className="grid w-full max-w-md grid-cols-3">
                  <TabsTrigger value="all" className="gap-2">
                    Alle ({allEvents.length})
                  </TabsTrigger>
                  <TabsTrigger value="saved" className="gap-2">
                    <Bookmark className="h-4 w-4" />
                    Opgeslagen ({favoriteEvents.length})
                  </TabsTrigger>
                  <TabsTrigger value="participating" className="gap-2">
                    <UserCheck className="h-4 w-4" />
                    Aangemeld ({participatingEvents.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {isLoading ? (
                <LoadingState />
              ) : displayEvents.length === 0 ? (
                <EmptyState />
              ) : (
                <div className={`grid gap-4 ${selectedEvent ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
                  {displayEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Event Detail Panel */}
          {selectedEvent && (
            <div className="w-1/2 border-l border-gray-200 h-full overflow-hidden">
              <EventDetailPanel
                event={selectedEvent}
                events={displayEvents}
                onClose={handleCloseEventDetail}
                onPrevious={() => handleNavigateEvent('previous')}
                onNext={() => handleNavigateEvent('next')}
              />
            </div>
          )}
        </div>
      </WebLayout>
    </>
  );
}

export default WebSavedPage;
