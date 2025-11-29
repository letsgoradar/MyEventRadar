import * as React from "react";
import AppLayout from "@/components/App/AppLayout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { EventInterface } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bookmark, UserCheck, CalendarPlus, Calendar, MapPin, Users, Edit, Trash2, X, Clock } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { getSmartImage } from "@/lib/smartImageSelection";
import { EventDetailPanel } from "@/components/App/EventDetailPanel";
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

export function AppMyEventsPage() {
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
    return format(date, "EEE d MMM", { locale: nl });
  };

  const formatEventTime = (dateString: string | Date) => {
    const date = new Date(dateString);
    return format(date, "HH:mm", { locale: nl });
  };

  const formatCreatedDate = (dateString: string | Date | undefined) => {
    if (!dateString) return "Onbekend";
    const date = new Date(dateString);
    return format(date, "d MMM yyyy", { locale: nl });
  };

  const LoadingState = () => (
    <div className="grid grid-cols-2 gap-3 px-4">
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className="h-48 bg-muted rounded-lg animate-pulse"></div>
      ))}
    </div>
  );

  const EmptyState = ({ type }: { type: string }) => {
    const messages = {
      organized: {
        icon: <CalendarPlus className="h-12 w-12 text-muted-foreground mb-3" />,
        title: "Nog geen evenementen",
        description: "Maak je eerste evenement aan!",
        buttonText: "Nieuw Evenement",
        buttonLink: "/app/create-event",
      },
      participating: {
        icon: <UserCheck className="h-12 w-12 text-muted-foreground mb-3" />,
        title: "Nog niet aangemeld",
        description: "Meld je aan voor evenementen.",
        buttonText: "Ontdek",
        buttonLink: "/app",
      },
      saved: {
        icon: <Bookmark className="h-12 w-12 text-muted-foreground mb-3" />,
        title: "Nog niets bewaard",
        description: "Bewaar evenementen voor later.",
        buttonText: "Ontdek",
        buttonLink: "/app",
      },
    };

    const msg = messages[type as keyof typeof messages] || messages.organized;

    return (
      <Card className="mx-3 mt-4">
        <CardContent className="flex flex-col items-center justify-center py-10">
          {msg.icon}
          <h2 className="text-lg font-bold mb-1">{msg.title}</h2>
          <p className="text-muted-foreground mb-4 text-center text-sm">
            {msg.description}
          </p>
          <Button asChild size="sm">
            <Link href={msg.buttonLink}>
              {msg.buttonText}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  };

  const CompactEventCard = ({ event }: { event: EventInterface }) => {
    const isOrganized = activeTab === "organized";
    
    return (
      <Card 
        className="cursor-pointer group overflow-hidden"
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
          {isOrganized && (
            <div className="absolute top-2 right-2">
              <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-primary text-primary-foreground">
                <Edit className="h-3 w-3 mr-1" />
                Beheren
              </Badge>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2.5">
            <span className="text-xs font-medium text-white/90 bg-white/20 px-2 py-0.5 rounded">
              {event.category}
            </span>
          </div>
        </div>
        <CardContent className="p-3">
          <h3 className="font-semibold text-sm mb-1.5 line-clamp-2">{event.title}</h3>
          <div className="space-y-1 text-xs text-muted-foreground">
            {event.startTime && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{formatEventDate(event.startTime)}</span>
              </div>
            )}
            {event.address && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="line-clamp-1">{event.address}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const EventManagementOverlay = ({ event }: { event: EventInterface }) => {
    const navigateToEdit = (section?: string) => {
      setLocation(`/app/edit-event/${event.id}${section ? `?section=${section}` : ''}`);
    };

    return (
      <div className="fixed inset-0 bg-background z-50 overflow-auto">
        <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold">Beheren</h2>
          <Button variant="ghost" size="icon" onClick={handleCloseManagement}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="p-4 pb-24 space-y-4">
          {/* Afbeelding - Bewerkbaar */}
          <div 
            className="relative h-40 rounded-lg overflow-hidden cursor-pointer group"
            onClick={() => navigateToEdit('image')}
          >
            <img 
              src={event.imageUrl || 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&h=400&fit=crop'}
              alt={event.title}
              className="w-full h-full object-cover transition-opacity group-hover:opacity-80"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2">
                <Edit className="h-5 w-5 text-primary" />
              </div>
            </div>
          </div>

          {/* Statistieken sectie - Niet bewerkbaar */}
          <div className="bg-muted/50 rounded-lg p-3 border border-dashed border-muted-foreground/20">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Statistieken</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-background rounded-md p-3 border">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="text-xs">Aangemaakt</span>
                </div>
                <p className="font-medium text-sm">{formatCreatedDate(event.createdAt)}</p>
              </div>
              <div className="bg-background rounded-md p-3 border">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                  <Users className="h-3.5 w-3.5" />
                  <span className="text-xs">Aanmeldingen</span>
                </div>
                <p className="font-medium text-base">{participants.length} / {event.maxParticipants || '∞'}</p>
              </div>
            </div>
          </div>

          {/* Deelnemers sectie - Niet bewerkbaar */}
          <div className="bg-muted/50 rounded-lg p-3 border border-dashed border-muted-foreground/20">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Deelnemers ({participants.length})</span>
            </div>
            {participants.length === 0 ? (
              <p className="text-sm text-muted-foreground bg-background rounded-md p-3 border">Nog geen aanmeldingen</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-auto bg-background rounded-md p-2 border">
                {participants.map((participant) => (
                  <div key={participant.id} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {participant.profilePhoto ? (
                        <img src={participant.profilePhoto} alt="" className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <span className="text-xs font-medium">
                          {(participant.firstName?.[0] || participant.username?.[0] || '?').toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {participant.firstName && participant.lastName 
                          ? `${participant.firstName} ${participant.lastName}`
                          : participant.username}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bewerkbare velden sectie */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-primary uppercase tracking-wide flex items-center gap-1.5">
              <Edit className="h-3 w-3" />
              Klik om te bewerken
            </p>
            
            {/* Titel en Categorie - Bewerkbaar */}
            <Card 
              className="cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors group"
              onClick={() => navigateToEdit('description')}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h1 className="text-xl font-bold mb-1">{event.title}</h1>
                    <Badge variant="outline" className="text-xs">{event.category}</Badge>
                  </div>
                  <Edit className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardContent>
            </Card>

            {/* Datum en Tijd - Bewerkbaar */}
            <Card 
              className="cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors group"
              onClick={() => navigateToEdit('datetime')}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      {event.startTime && (
                        <p className="text-sm font-medium">{format(new Date(event.startTime), "EEEE d MMMM yyyy", { locale: nl })}</p>
                      )}
                      {event.startTime && event.endTime && (
                        <p className="text-xs text-muted-foreground">
                          {formatEventTime(event.startTime)} - {formatEventTime(event.endTime)}
                        </p>
                      )}
                    </div>
                  </div>
                  <Edit className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardContent>
            </Card>

            {/* Locatie - Bewerkbaar */}
            {event.address && (
              <Card 
                className="cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors group"
                onClick={() => navigateToEdit('location')}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm">{event.address}</p>
                    </div>
                    <Edit className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Beschrijving - Bewerkbaar */}
            {event.description && (
              <Card 
                className="cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors group"
                onClick={() => navigateToEdit('description')}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-1">Beschrijving</p>
                      <p className="text-sm text-muted-foreground line-clamp-3">{event.description}</p>
                    </div>
                    <Edit className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2" />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button 
              className="flex-1" 
              onClick={() => navigateToEdit()}
            >
              <Edit className="h-4 w-4 mr-2" />
              Alles bewerken
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => setDeleteEventId(event.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <AppLayout title="Mijn Events" hideViewToggle={true} defaultView="list" hideSearchAndFilters={true}>
        <div className="pb-20">
          <div className="sticky top-0 bg-background z-10 border-b">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-3 h-11 rounded-none">
                <TabsTrigger value="organized" className="text-xs px-1 gap-1">
                  <CalendarPlus className="h-3 w-3" />
                  Mijn
                  ({organizedEvents.length})
                </TabsTrigger>
                <TabsTrigger value="participating" className="text-xs px-1 gap-1">
                  <UserCheck className="h-3 w-3" />
                  <span className="hidden xs:inline">Aangemeld</span>
                  <span className="xs:hidden">Aanm.</span>
                  ({participatingEvents.length})
                </TabsTrigger>
                <TabsTrigger value="saved" className="text-xs px-1 gap-1">
                  <Bookmark className="h-3 w-3" />
                  Bewaard
                  ({favoriteEvents.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          {isLoading ? (
            <div className="pt-4">
              <LoadingState />
            </div>
          ) : displayEvents.length === 0 ? (
            <EmptyState type={activeTab} />
          ) : (
            <div className="grid grid-cols-2 gap-3 px-4 pt-4">
              {displayEvents.map((event) => (
                <CompactEventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </AppLayout>
      
      {managingEvent && (
        <EventManagementOverlay event={managingEvent} />
      )}

      {selectedEvent && !managingEvent && (
        <EventDetailPanel
          event={selectedEvent}
          events={displayEvents}
          onClose={handleCloseEventDetail}
          onPrevious={() => handleNavigateEvent('previous')}
          onNext={() => handleNavigateEvent('next')}
        />
      )}

      <AlertDialog open={deleteEventId !== null} onOpenChange={() => setDeleteEventId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Evenement verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je dit evenement wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteEventId && deleteEventMutation.mutate(deleteEventId)}
              className="bg-destructive text-destructive-foreground"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default AppMyEventsPage;
