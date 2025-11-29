import * as React from "react";
import WebLayout from "@/components/Web/WebLayout";
import MapView from "@/components/Map/MapView";
import { useQuery, useMutation } from "@tanstack/react-query";
import { EventInterface } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bookmark, UserCheck, Calendar, MapPin, Clock, Users, Edit, Trash2, Eye, ChevronRight, CalendarPlus, Map } from "lucide-react";
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
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
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
import L from "leaflet";

const MemoizedMapView = React.memo(MapView, (prevProps, nextProps) => {
  return (
    prevProps.searchQuery === nextProps.searchQuery &&
    prevProps.radius === nextProps.radius &&
    prevProps.filteredEvents === nextProps.filteredEvents &&
    prevProps.showExpiredEvents === nextProps.showExpiredEvents
  );
});

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
  const [hoveredEventId, setHoveredEventId] = React.useState<number | null>(null);
  
  // Sync hover state to window global for MapView to read without re-render
  React.useEffect(() => {
    (window as any).hoveredEventId = hoveredEventId;
  }, [hoveredEventId]);
  
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

  // Zoom kaart naar alle events wanneer tab of events veranderen
  React.useEffect(() => {
    if (displayEvents.length === 0) return;
    
    // Verzamel alle event coördinaten
    const validEvents = displayEvents.filter(e => e.latitude && e.longitude);
    if (validEvents.length === 0) return;
    
    // Maak bounds die alle events bevatten
    const bounds = L.latLngBounds(
      validEvents.map(e => L.latLng(Number(e.latitude), Number(e.longitude)))
    );
    
    // Voeg padding toe en zoom naar de bounds - gebruik window.mapRef
    setTimeout(() => {
      const mapRef = (window as any).mapRef?.current;
      if (mapRef) {
        mapRef.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 14,
          animate: true,
          duration: 0.8
        });
      }
    }, 500);
  }, [displayEvents, activeTab]);

  const handleEventClick = React.useCallback((event: EventInterface) => {
    if (activeTab === "organized") {
      setManagingEvent(event);
      setSelectedEvent(null);
    } else {
      setSelectedEvent(event);
      setManagingEvent(null);
    }
  }, [activeTab]);

  const handleMapEventClick = React.useCallback((event: EventInterface) => {
    handleEventClick(event);
  }, [handleEventClick]);

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

  // Stabiele hover handlers om re-renders te voorkomen
  const handleEventHover = React.useCallback((eventId: number | null) => {
    setHoveredEventId(eventId);
  }, []);

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
    <div className="space-y-3">
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className="h-20 bg-muted rounded-lg animate-pulse"></div>
      ))}
    </div>
  );

  const EmptyState = ({ type }: { type: string }) => {
    const messages = {
      organized: {
        icon: <CalendarPlus className="h-12 w-12 text-muted-foreground mb-3" />,
        title: "Nog geen evenementen",
        description: "Je hebt nog geen evenementen aangemaakt.",
        buttonText: "Nieuw Evenement",
        buttonLink: "/web/create-event",
      },
      participating: {
        icon: <UserCheck className="h-12 w-12 text-muted-foreground mb-3" />,
        title: "Nog niet aangemeld",
        description: "Je hebt je nog niet aangemeld voor evenementen.",
        buttonText: "Ontdek evenementen",
        buttonLink: "/web",
      },
      saved: {
        icon: <Bookmark className="h-12 w-12 text-muted-foreground mb-3" />,
        title: "Nog niets bewaard",
        description: "Je hebt nog geen evenementen bewaard.",
        buttonText: "Ontdek evenementen",
        buttonLink: "/web",
      },
    };

    const msg = messages[type as keyof typeof messages] || messages.organized;

    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        {msg.icon}
        <h3 className="text-lg font-semibold mb-1">{msg.title}</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-xs">
          {msg.description}
        </p>
        <Button asChild size="sm">
          <Link href={msg.buttonLink}>
            {msg.buttonText}
          </Link>
        </Button>
      </div>
    );
  };

  const EventListItem = ({ event }: { event: EventInterface }) => {
    const isOrganized = activeTab === "organized";
    const isActive = selectedEvent?.id === event.id || managingEvent?.id === event.id;
    const isHovered = hoveredEventId === event.id;
    
    return (
      <div 
        className={`flex gap-3 p-3 rounded-lg cursor-pointer transition-all hover:bg-accent/50 ${isActive ? 'bg-accent ring-2 ring-primary' : (isHovered ? 'bg-accent/30 ring-2 ring-primary/50' : 'bg-card')}`}
        onClick={() => handleEventClick(event)}
        onMouseEnter={() => handleEventHover(event.id)}
        onMouseLeave={() => handleEventHover(null)}
        data-testid={`listitem-event-${event.id}`}
      >
        <div className="relative w-20 h-20 flex-shrink-0 rounded-md overflow-hidden">
          <img 
            src={event.imageUrl || getSmartImage(event.title || '', event.description || '').image || 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=400&h=300&fit=crop'}
            alt={event.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.src = 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=400&h=300&fit=crop';
            }}
          />
          {isOrganized && (
            <div className="absolute top-1 right-1">
              <Badge variant="secondary" className="bg-primary text-primary-foreground text-[10px] px-1 py-0">
                <Edit className="h-2.5 w-2.5" />
              </Badge>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm line-clamp-1 mb-1">{event.title}</h3>
          <div className="space-y-0.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span className="line-clamp-1">{event.startTime ? format(new Date(event.startTime), "d MMM, HH:mm", { locale: nl }) : 'Geen datum'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="line-clamp-1">{event.address || 'Geen locatie'}</span>
            </div>
          </div>
          <Badge variant="outline" className="mt-1.5 text-[10px]">{event.category}</Badge>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground self-center flex-shrink-0" />
      </div>
    );
  };

  const EventManagementPanel = ({ event }: { event: EventInterface }) => {
    const navigateToEdit = (section?: string) => {
      const url = `/web/edit-event/${event.id}${section ? `?section=${section}` : ''}`;
      window.location.href = url;
    };

    return (
      <div className="h-full overflow-auto bg-background">
        <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold">Evenement Beheren</h2>
          <Button variant="ghost" size="sm" onClick={handleCloseManagement}>
            ✕
          </Button>
        </div>
        
        <div className="p-6 space-y-6">
          <div 
            className="relative h-48 rounded-lg overflow-hidden cursor-pointer group"
            onClick={() => navigateToEdit('image')}
          >
            <img 
              src={event.imageUrl || 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&h=400&fit=crop'}
              alt={event.title}
              className="w-full h-full object-cover transition-opacity group-hover:opacity-80"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-3">
                <Edit className="h-6 w-6 text-primary" />
              </div>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 border border-dashed border-muted-foreground/20">
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Statistieken</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-background rounded-md p-4 border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">Aangemaakt</span>
                </div>
                <p className="font-medium text-sm">{formatCreatedDate(event.createdAt)}</p>
              </div>
              <div className="bg-background rounded-md p-4 border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">Aanmeldingen</span>
                </div>
                <p className="font-medium text-lg">{participants.length} / {event.maxParticipants || '∞'}</p>
              </div>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 border border-dashed border-muted-foreground/20">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Aangemelde Deelnemers ({participants.length})</span>
            </div>
            {participants.length === 0 ? (
              <p className="text-sm text-muted-foreground bg-background rounded-md p-4 border">Nog geen aanmeldingen</p>
            ) : (
              <div className="space-y-2 bg-background rounded-md p-3 border">
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
          </div>

          <div className="space-y-4">
            <p className="text-xs font-medium text-primary uppercase tracking-wide flex items-center gap-1.5">
              <Edit className="h-3.5 w-3.5" />
              Klik om te bewerken
            </p>
            
            <Card 
              className="cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors group"
              onClick={() => navigateToEdit('description')}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold mb-2">{event.title}</h1>
                    <Badge>{event.category}</Badge>
                  </div>
                  <Edit className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors group"
              onClick={() => navigateToEdit('datetime')}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Wanneer
                  </CardTitle>
                  <Edit className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
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

            <Card 
              className="cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors group"
              onClick={() => navigateToEdit('location')}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Locatie
                  </CardTitle>
                  <Edit className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm">{event.address || 'Geen locatie opgegeven'}</p>
              </CardContent>
            </Card>

            {event.description && (
              <Card 
                className="cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors group"
                onClick={() => navigateToEdit('description')}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Beschrijving</CardTitle>
                    <Edit className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground line-clamp-4">{event.description}</p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex gap-3 pt-4">
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
              <Trash2 className="h-4 w-4 mr-2" />
              Verwijderen
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // Sidebar component met sidebar
  const Sidebar = React.lazy(() => import("@/components/Web/Sidebar"));

  return (
    <>
      <div className="h-screen flex overflow-hidden">
        <React.Suspense fallback={<div className="w-[260px] bg-background border-r" />}>
          <Sidebar />
        </React.Suspense>
        
        <div className="flex-1 flex flex-col relative">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Linker paneel: Kaart */}
            <ResizablePanel defaultSize={55} minSize={35} className="relative">
              <div className="h-full overflow-hidden">
                <MemoizedMapView 
                  searchQuery=""
                  radius={50}
                  filteredEvents={displayEvents}
                  onEventClick={handleMapEventClick}
                  showExpiredEvents={true}
                  hoveredEventId={hoveredEventId}
                />
                
                {/* Overlay met titel */}
                <div className="absolute top-4 left-4 z-[400] bg-background/95 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2">
                  <div className="flex items-center gap-2">
                    <Map className="h-5 w-5 text-primary" />
                    <span className="font-semibold">
                      {displayEvents.length} event{displayEvents.length !== 1 ? 's' : ''} op de kaart
                    </span>
                  </div>
                </div>
              </div>
            </ResizablePanel>
            
            <ResizableHandle withHandle className="z-50 bg-primary" />
            
            {/* Rechter paneel: Tabs en Event lijst */}
            <ResizablePanel defaultSize={45} minSize={30} className="relative bg-background">
              <div className="h-full flex flex-col">
                {/* Header met tabs */}
                <div className="p-4 border-b bg-background">
                  <h1 className="text-2xl font-bold mb-4">Mijn Events</h1>
                  
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="organized" className="gap-1.5 text-xs sm:text-sm">
                        <CalendarPlus className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Mijn</span> ({organizedEvents.length})
                      </TabsTrigger>
                      <TabsTrigger value="participating" className="gap-1.5 text-xs sm:text-sm">
                        <UserCheck className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Aangemeld</span> ({participatingEvents.length})
                      </TabsTrigger>
                      <TabsTrigger value="saved" className="gap-1.5 text-xs sm:text-sm">
                        <Bookmark className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Bewaard</span> ({favoriteEvents.length})
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                
                {/* Event lijst of detail panel */}
                <div className="flex-1 overflow-hidden">
                  {selectedEvent ? (
                    <EventDetailPanel
                      event={selectedEvent}
                      events={displayEvents}
                      onClose={handleCloseEventDetail}
                      onPrevious={() => handleNavigateEvent('previous')}
                      onNext={() => handleNavigateEvent('next')}
                    />
                  ) : managingEvent ? (
                    <EventManagementPanel event={managingEvent} />
                  ) : (
                    <div className="h-full overflow-auto p-4">
                      {isLoading ? (
                        <LoadingState />
                      ) : displayEvents.length === 0 ? (
                        <EmptyState type={activeTab} />
                      ) : (
                        <div className="space-y-2">
                          {displayEvents.map((event) => (
                            <EventListItem key={event.id} event={event} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>

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
