import * as React from "react";
import WebLayout from "@/components/Web/WebLayout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { EventInterface } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bookmark, UserCheck, Calendar, MapPin, Clock, Users, Edit, Trash2, Eye, ChevronRight, CalendarPlus } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { getSmartImage } from "@/lib/smartImageSelection";
import { EventDetailPanel } from "@/components/Web/EventDetailPanel";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ParticipantInfo {
  id: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profilePhoto?: string;
}

export function WebMyEventsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = React.useState<string>("organized");
  const [selectedEvent, setSelectedEvent] = React.useState<EventInterface | null>(null);
  const [managingEvent, setManagingEvent] = React.useState<EventInterface | null>(null);
  const [deleteEventId, setDeleteEventId] = React.useState<number | null>(null);
  
  const { data: organizedEvents = [], isLoading: loadingOrganized } = useQuery<EventInterface[]>({
    queryKey: ['/api/events/byuser', user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/events/byuser/${user?.id}`);
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    },
    enabled: !!user?.id,
  });

  const { data: participatingEvents = [], isLoading: loadingParticipating } = useQuery<EventInterface[]>({
    queryKey: [`/api/events/participation/${user?.id}`],
    enabled: !!user?.id,
  });

  const { data: favoriteEvents = [], isLoading: loadingFavorites } = useQuery<EventInterface[]>({
    queryKey: ['/api/events/favorites'],
    enabled: !!user,
  });

  const { data: participants = [] } = useQuery<ParticipantInfo[]>({
    queryKey: ['/api/participants', managingEvent?.id],
    queryFn: async () => {
      const response = await fetch(`/api/participants/${managingEvent?.id}`);
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    },
    enabled: !!managingEvent?.id,
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      await apiRequest(`/api/events/${eventId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events/byuser', user?.id] });
      toast({
        title: "Evenement verwijderd",
        description: "Het evenement is succesvol verwijderd.",
      });
      setDeleteEventId(null);
      setManagingEvent(null);
    },
    onError: () => {
      toast({
        title: "Fout",
        description: "Er is iets misgegaan bij het verwijderen.",
        variant: "destructive",
      });
    },
  });

  const isLoading = loadingOrganized || loadingParticipating || loadingFavorites;

  const displayEvents = React.useMemo(() => {
    if (activeTab === "organized") return organizedEvents;
    if (activeTab === "participating") return participatingEvents;
    if (activeTab === "saved") return favoriteEvents;
    return organizedEvents;
  }, [activeTab, organizedEvents, participatingEvents, favoriteEvents]);

  const handleEventClick = React.useCallback((event: EventInterface) => {
    if (activeTab === "organized") {
      setManagingEvent(event);
      setSelectedEvent(null);
    } else {
      setSelectedEvent(event);
      setManagingEvent(null);
    }
  }, [activeTab]);

  const handleCloseEventDetail = React.useCallback(() => {
    setSelectedEvent(null);
  }, []);

  const handleCloseManagement = React.useCallback(() => {
    setManagingEvent(null);
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

  const formatEventDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return format(date, "EEEE d MMMM yyyy", { locale: nl });
  };

  const formatEventTime = (dateString: string | Date) => {
    const date = new Date(dateString);
    return format(date, "HH:mm", { locale: nl });
  };

  const formatCreatedDate = (dateString: string | Date | undefined) => {
    if (!dateString) return "Onbekend";
    const date = new Date(dateString);
    return format(date, "d MMMM yyyy 'om' HH:mm", { locale: nl });
  };

  const LoadingState = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
        <div key={n} className="h-48 bg-muted rounded-lg animate-pulse"></div>
      ))}
    </div>
  );

  const EmptyState = ({ type }: { type: string }) => {
    const messages = {
      organized: {
        icon: <CalendarPlus className="h-16 w-16 text-muted-foreground mb-4" />,
        title: "Nog geen evenementen georganiseerd",
        description: "Je hebt nog geen evenementen aangemaakt. Maak je eerste evenement aan!",
        buttonText: "Nieuw Evenement",
        buttonLink: "/web/create-event",
      },
      participating: {
        icon: <UserCheck className="h-16 w-16 text-muted-foreground mb-4" />,
        title: "Nog niet aangemeld",
        description: "Je hebt je nog niet aangemeld voor evenementen.",
        buttonText: "Ontdek evenementen",
        buttonLink: "/web",
      },
      saved: {
        icon: <Bookmark className="h-16 w-16 text-muted-foreground mb-4" />,
        title: "Nog niets bewaard",
        description: "Je hebt nog geen evenementen bewaard.",
        buttonText: "Ontdek evenementen",
        buttonLink: "/web",
      },
    };

    const msg = messages[type as keyof typeof messages] || messages.organized;

    return (
      <Card className="mt-8">
        <CardContent className="flex flex-col items-center justify-center py-16">
          {msg.icon}
          <h2 className="text-2xl font-bold mb-2">{msg.title}</h2>
          <p className="text-muted-foreground mb-6 text-center max-w-md">
            {msg.description}
          </p>
          <Button asChild size="lg">
            <Link href={msg.buttonLink}>
              {msg.buttonText}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  };

  const EventCard = ({ event }: { event: EventInterface }) => {
    const isOrganized = activeTab === "organized";
    
    return (
      <Card 
        className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group h-full"
        onClick={() => handleEventClick(event)}
        data-testid={`card-event-${event.id}`}
      >
        <div className="relative h-32 overflow-hidden">
          <img 
            src={event.imageUrl || getSmartImage(event.title || '', event.description || '').image || 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=400&h=300&fit=crop'}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              e.currentTarget.src = 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=400&h=300&fit=crop';
            }}
          />
          <div className="absolute top-2 right-2">
            {isOrganized && (
              <Badge variant="secondary" className="bg-primary text-primary-foreground">
                <Edit className="h-3 w-3 mr-1" />
                Beheren
              </Badge>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
            <span className="text-xs font-medium text-white/90 bg-white/20 px-2 py-0.5 rounded">
              {event.category}
            </span>
          </div>
        </div>
        <CardContent className="p-3">
          <h3 className="font-semibold text-sm mb-1 line-clamp-1">{event.title}</h3>
          <div className="space-y-1 text-xs text-muted-foreground">
            {event.startTime && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3 w-3 flex-shrink-0" />
                <span className="line-clamp-1">{formatEventDate(event.startTime)}</span>
              </div>
            )}
            {event.address && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="line-clamp-1">{event.address}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const EventManagementPanel = ({ event }: { event: EventInterface }) => (
    <div className="h-full overflow-auto bg-background">
      <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between z-10">
        <h2 className="text-xl font-bold">Evenement Beheren</h2>
        <Button variant="ghost" size="sm" onClick={handleCloseManagement}>
          ✕
        </Button>
      </div>
      
      <div className="p-6 space-y-6">
        <div className="relative h-48 rounded-lg overflow-hidden">
          <img 
            src={event.imageUrl || 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&h=400&fit=crop'}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        </div>

        <div>
          <h1 className="text-2xl font-bold mb-2">{event.title}</h1>
          <Badge>{event.category}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">Aangemaakt</span>
              </div>
              <p className="font-medium text-sm">{formatCreatedDate(event.createdAt)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Users className="h-4 w-4" />
                <span className="text-sm">Aanmeldingen</span>
              </div>
              <p className="font-medium text-lg">{participants.length} / {event.maxParticipants || '∞'}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Wanneer
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {event.startTime && (
              <p className="text-sm">{formatEventDate(event.startTime)}</p>
            )}
            {event.startTime && event.endTime && (
              <p className="text-sm text-muted-foreground">
                {formatEventTime(event.startTime)} - {formatEventTime(event.endTime)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Locatie
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm">{event.address || 'Geen locatie opgegeven'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Aangemelde Deelnemers ({participants.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {participants.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nog geen aanmeldingen</p>
            ) : (
              <div className="space-y-2">
                {participants.map((participant) => (
                  <div key={participant.id} className="flex items-center gap-3 p-2 bg-muted rounded-lg">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      {participant.profilePhoto ? (
                        <img src={participant.profilePhoto} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <span className="text-sm font-medium">
                          {(participant.firstName?.[0] || participant.username?.[0] || '?').toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {participant.firstName && participant.lastName 
                          ? `${participant.firstName} ${participant.lastName}`
                          : participant.username}
                      </p>
                      <p className="text-xs text-muted-foreground">{participant.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {event.description && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Beschrijving</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground">{event.description}</p>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3 pt-4">
          <Button 
            className="flex-1" 
            onClick={() => setLocation(`/web/edit-event/${event.id}`)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Bewerken
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => setDeleteEventId(event.id)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Verwijderen
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <WebLayout>
        <div className="flex h-full">
          <div className={`${selectedEvent || managingEvent ? 'w-1/2' : 'w-full'} transition-all duration-300 overflow-auto`}>
            <div className="p-6 max-w-7xl mx-auto">
              <div className="mb-6">
                <h1 className="text-3xl font-bold mb-2">Mijn Events</h1>
                <p className="text-muted-foreground">
                  Bekijk en beheer al je evenementen op één plek.
                </p>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
                <TabsList className="grid w-full max-w-lg grid-cols-3">
                  <TabsTrigger value="organized" className="gap-2">
                    <CalendarPlus className="h-4 w-4" />
                    Georganiseerd ({organizedEvents.length})
                  </TabsTrigger>
                  <TabsTrigger value="participating" className="gap-2">
                    <UserCheck className="h-4 w-4" />
                    Aangemeld ({participatingEvents.length})
                  </TabsTrigger>
                  <TabsTrigger value="saved" className="gap-2">
                    <Bookmark className="h-4 w-4" />
                    Bewaard ({favoriteEvents.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {isLoading ? (
                <LoadingState />
              ) : displayEvents.length === 0 ? (
                <EmptyState type={activeTab} />
              ) : (
                <div className={`grid gap-4 ${selectedEvent || managingEvent ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
                  {displayEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {managingEvent && (
            <div className="w-1/2 border-l border-gray-200 h-full overflow-hidden">
              <EventManagementPanel event={managingEvent} />
            </div>
          )}

          {selectedEvent && !managingEvent && (
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

      <AlertDialog open={deleteEventId !== null} onOpenChange={() => setDeleteEventId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Evenement verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je dit evenement wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteEventId && deleteEventMutation.mutate(deleteEventId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default WebMyEventsPage;
