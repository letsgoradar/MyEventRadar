import React, { useState } from "react";
import { ArrowLeft, ArrowRight, X, Calendar, MapPin, Users, Euro, Clock, Heart, UserPlus, UserCheck, Navigation, ExternalLink, ChevronDown, Globe } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ShareMenu } from "@/components/ShareMenu";
import { trackEventView, trackExternalClick, trackAddFavorite } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/CategoryIcon";
import { EventInterface as Event } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ExternalLinkInterstitial } from "@/components/Ads/ExternalLinkInterstitial";
import { getDeterministicCategoryImage } from "@/lib/categoryImages";

const formatDateTime = (dateInput: string | Date) => {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const utcH = date.getUTCHours(), utcM = date.getUTCMinutes(), utcS = date.getUTCSeconds();
  const isDateOnly = (utcH === 0 && utcM === 0 && utcS === 0) || (utcH === 23 && utcM === 59 && utcS === 59);
  if (isDateOnly) {
    return date.toLocaleDateString('nl-NL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
  return date.toLocaleDateString('nl-NL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

interface EventDetailPanelProps {
  event: Event;
  events: Event[];
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}

export function EventDetailPanel({ 
  event, 
  events, 
  onClose,
  onPrevious,
  onNext 
}: EventDetailPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: favorites = [] } = useQuery<any[]>({
    queryKey: [`/api/favorites/${user?.id}`],
    enabled: !!user?.id,
  });

  const { data: participatingEvents = [] } = useQuery<any[]>({
    queryKey: [`/api/events/participation/${user?.id}`],
    enabled: !!user?.id,
  });

  const isFavorited = favorites.some((fav: any) => fav.id === event.id);
  const isParticipating = participatingEvents.some((e: any) => e.id === event.id);
  const [showFullDescription, setShowFullDescription] = useState(false);

  // Track detail view when panel opens
  React.useEffect(() => {
    const trackView = async () => {
      try {
        await fetch(`/api/events/${event.id}/track-view`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        trackEventView(event.title, event.id, event.category);
      } catch (error) {
        // Silently fail - tracking is not critical
      }
    };
    trackView();
  }, [event.id]);

  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      if (isFavorited) {
        const response = await fetch(`/api/favorite/${event.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to remove favorite');
      } else {
        const response = await fetch('/api/favorite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ eventId: event.id }),
        });
        if (!response.ok) throw new Error('Failed to add favorite');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/favorites/${user?.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/events/favorites'] });
      if (!isFavorited) trackAddFavorite(event.title, event.id);
      toast({
        title: isFavorited ? "Verwijderd uit opgeslagen" : "Toegevoegd aan opgeslagen",
        description: isFavorited ? "Het evenement is verwijderd uit je opgeslagen events." : "Je ontvangt notificaties voor wijzigingen.",
      });
    },
    onError: () => {
      toast({
        title: "Fout bij opslaan",
        description: "Er ging iets mis bij het opslaan.",
        variant: "destructive",
      });
    },
  });

  const toggleParticipantMutation = useMutation({
    mutationFn: async () => {
      if (isParticipating) {
        const response = await fetch(`/api/participate/${event.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to leave event');
      } else {
        const response = await fetch(`/api/participate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ eventId: event.id }),
        });
        if (!response.ok) throw new Error('Failed to join event');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/participation/${user?.id}`] });
      toast({
        title: isParticipating ? "Afgemeld voor evenement" : "Aangemeld voor evenement",
        description: isParticipating ? "Je bent afgemeld voor dit evenement." : "Je ontvangt herinneringen voor dit evenement.",
      });
    },
    onError: () => {
      toast({
        title: "Fout bij aanmelden",
        description: "Er ging iets mis bij het aanmelden.",
        variant: "destructive",
      });
    },
  });

  // Fetch event sources (multiple sources from different feeds)
  interface EventSource {
    id: number;
    eventId: number;
    feedId: number;
    sourceUrl: string;
    sourceName: string;
    isPrimary: boolean;
  }
  const { data: eventSources = [] } = useQuery<EventSource[]>({
    queryKey: ['/api/events', event.id, 'sources'],
    queryFn: async () => {
      const response = await fetch(`/api/events/${event.id}/sources`, {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!event.externalUrl,
    staleTime: 60000,
  });

  // State voor interstitial
  const [showInterstitial, setShowInterstitial] = useState(false);
  const [interstitialUrl, setInterstitialUrl] = useState<string | null>(null);

  const openExternalPageMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/events/${event.id}/track-external-open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to track external page open');
      return response.json();
    },
  });

  const handleOpenExternalPage = () => {
    if (event.externalUrl) {
      openExternalPageMutation.mutate();
      trackExternalClick(event.externalUrl, event.title);
      setInterstitialUrl(event.externalUrl);
      setShowInterstitial(true);
    }
  };

  const handleOpenSourceWithInterstitial = (sourceUrl: string) => {
    openExternalPageMutation.mutate();
    trackExternalClick(sourceUrl, event.title);
    setInterstitialUrl(sourceUrl);
    setShowInterstitial(true);
  };

  const handleCloseInterstitial = () => {
    setShowInterstitial(false);
    setInterstitialUrl(null);
  };

  const handleToggleFavorite = () => {
    if (!user) {
      toast({
        title: "Inloggen vereist",
        description: "Log in om evenementen op te slaan.",
        variant: "destructive",
      });
      return;
    }
    toggleFavoriteMutation.mutate();
  };

  const handleToggleParticipant = () => {
    if (!user) {
      toast({
        title: "Inloggen vereist",
        description: "Log in om je aan te melden voor evenementen.",
        variant: "destructive",
      });
      return;
    }
    toggleParticipantMutation.mutate();
  };

  const currentIndex = events.findIndex(e => e.id === event.id);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < events.length - 1;

  const handlePrevious = () => {
    if (hasPrevious && onPrevious) {
      onPrevious();
    }
  };

  const handleNext = () => {
    if (hasNext && onNext) {
      onNext();
    }
  };

  const openNavigationApp = () => {
    const lat = typeof event.latitude === 'number' ? event.latitude : parseFloat(event.latitude);
    const lng = typeof event.longitude === 'number' ? event.longitude : parseFloat(event.longitude);
    
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      const appleNavigationUrl = `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
      
      if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        window.open(appleNavigationUrl, '_blank');
      } else {
        window.open(googleMapsUrl, '_blank');
      }
    } else {
      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      window.open(googleMapsUrl, '_blank');
    }
  };


  return (
    <>
    {showInterstitial && (interstitialUrl || event.externalUrl) && (
      <ExternalLinkInterstitial
        externalUrl={(interstitialUrl || event.externalUrl)!}
        eventTitle={event.title}
        onClose={handleCloseInterstitial}
        eventLat={Number(event.latitude)}
        eventLng={Number(event.longitude)}
        eventCategory={event.category}
        eventId={event.id}
      />
    )}
    <div className="w-full h-full bg-background text-foreground flex flex-col">
      <div className="flex min-h-[58px] items-center justify-between border-b border-border bg-card/90 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handlePrevious}
            disabled={!hasPrevious}
            className="rounded-full p-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={onClose}
            className="rounded-full px-4"
          >
            Terug naar overzicht
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleNext}
            disabled={!hasNext}
            className="rounded-full p-2"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        
        <Button 
          variant="ghost" 
          size="sm"
          onClick={onClose}
           className="rounded-full p-2"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {(() => {
          const displayImage = event.imageUrl || getDeterministicCategoryImage(event.category, event.id);
          const isStockPhoto = !event.imageUrl;
          return (
            <div className="relative h-44 overflow-hidden sm:h-52">
              <img
                src={displayImage}
                alt={event.title}
                className="w-full h-full object-cover"
              />
              {isStockPhoto && (
                <div className="absolute bottom-2 right-2">
                  <span className="bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">
                    Stockfoto
                  </span>
                </div>
              )}
              {(event as any).isHighlighted && (
                <div className="absolute top-4 left-4">
                  <Badge className="bg-amber-500 text-white">Uitgelicht</Badge>
                </div>
              )}
            </div>
          );
        })()}

        <div className="space-y-7 p-5 pb-8 sm:p-7 sm:pb-10">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary" className="flex items-center gap-1.5 rounded-full px-3 py-1">
              <CategoryIcon category={event.category as any} className="h-4 w-4" />
              {event.category}
            </Badge>
            {event.secondaryCategory && (
              <Badge variant="outline" className="flex items-center gap-1.5 rounded-full px-3 py-1">
                <CategoryIcon category={event.secondaryCategory as any} className="h-4 w-4" />
                {event.secondaryCategory}
              </Badge>
            )}
          </div>

          <h1 className="max-w-2xl text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
            {event.title}
          </h1>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/60 p-3 text-muted-foreground">
              <Calendar className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
              <div className="min-w-0">
                <div className="font-medium text-foreground">{formatDateTime(event.startTime)}</div>
                {event.endTime && (
                  <div className="text-sm text-muted-foreground">
                    tot {formatDateTime(event.endTime)}
                  </div>
                )}
              </div>
            </div>

            {event.address && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/60 p-3 text-muted-foreground">
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 flex-shrink-0 text-primary" />
                  <span className="min-w-0 truncate text-foreground">{event.address}</span>
                </div>
                <Button 
                  onClick={openNavigationApp}
                  variant="outline"
                  size="sm"
                   className="flex-shrink-0 rounded-full"
                  title="Navigeer naar locatie"
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  Navigeer
                </Button>
              </div>
            )}

            {event.maxParticipants && (
              <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/60 p-3 text-muted-foreground">
                <Users className="h-5 w-5 flex-shrink-0 text-primary" />
                <span className="text-foreground">Maximaal {event.maxParticipants} deelnemers</span>
              </div>
            )}

            {event.isPaid && event.price && (
              <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/60 p-3 text-muted-foreground">
                <Euro className="h-5 w-5 flex-shrink-0 text-primary" />
                <span className="text-foreground">€{event.price}</span>
              </div>
            )}
          </div>

          {event.description && (
            <div className="space-y-3">
                <h3 className="text-lg font-semibold text-foreground">
                Beschrijving
              </h3>
              <div className="text-foreground/85 leading-relaxed">
                {showFullDescription ? (
                  <p className="whitespace-pre-wrap">{event.description}</p>
                ) : (
                  <p className="line-clamp-5">{event.description}</p>
                )}
                {event.description.length > 200 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFullDescription(!showFullDescription)}
                     className="mt-2 h-auto p-0 text-primary hover:text-primary/80"
                  >
                    {showFullDescription ? 'Minder tonen' : 'Meer lezen'}
                  </Button>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      <div className="flex-shrink-0 border-t border-border bg-card/95 px-5 py-3 shadow-[0_-8px_20px_hsl(var(--foreground)/0.08)] backdrop-blur-md sm:px-7">
          <div className="flex flex-wrap gap-2">
            {event.externalUrl ? (
              eventSources.length > 1 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                       className="min-w-[190px] flex-1 rounded-full text-sm"
                      data-testid="button-open-external-page"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Bekijk op originele site ({eventSources.length})
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    {eventSources.map((source) => (
                      <DropdownMenuItem
                        key={source.id}
                        onClick={() => handleOpenSourceWithInterstitial(source.sourceUrl)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <div className="flex flex-col">
                          <span className="font-medium">{source.sourceName}</span>
                          {source.isPrimary && (
                            <span className="text-xs text-green-600">Primaire bron</span>
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                   className="min-w-[190px] flex-1 rounded-full text-sm"
                  onClick={handleOpenExternalPage}
                  disabled={openExternalPageMutation.isPending}
                  data-testid="button-open-external-page"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Bekijk op originele site
                </Button>
              )
            ) : (
              <Button 
                 className="min-w-[150px] flex-1 rounded-full text-sm"
                onClick={handleToggleParticipant}
                disabled={toggleParticipantMutation.isPending}
                variant={isParticipating ? "secondary" : "default"}
              >
                {isParticipating ? (
                  <>
                    <UserCheck className="h-4 w-4 mr-2" />
                    Aangemeld
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Aanmelden
                  </>
                )}
              </Button>
            )}
            
            <Button 
                 className="rounded-full text-sm"
              variant={isFavorited ? "secondary" : "outline"}
              onClick={handleToggleFavorite}
              disabled={toggleFavoriteMutation.isPending}
            >
              <Heart className={cn("h-4 w-4 mr-2", isFavorited ? "fill-primary text-primary" : "text-primary")} />
              {isFavorited ? "Opgeslagen" : "Opslaan"}
            </Button>
            
            
            <ShareMenu 
              title={event.title}
              url={`${window.location.origin}/web/event/${event.id}`}
              description={event.description?.substring(0, 100)}
              variant="web"
              buttonSize="sm"
            />
      </div>
    </div>
    </div>
    </>
  );
}

export default EventDetailPanel;
