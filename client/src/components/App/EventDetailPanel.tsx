import React, { useState } from "react";
import { ArrowLeft, ArrowRight, X, Calendar, MapPin, Users, Euro, Clock, Heart, UserPlus, Navigation, ExternalLink, Eye, ChevronDown, Globe, Link } from "lucide-react";
import { ShareMenu } from "@/components/ShareMenu";
import { ExternalLinkInterstitial } from "@/components/Ads/ExternalLinkInterstitial";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import CategoryIcon from "@/components/Events/CategoryIcon";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface EventSource {
  id: number;
  eventId: number;
  feedId: number | null;
  sourceUrl: string;
  sourceName: string;
  isPrimary: boolean;
}

// Define Event type - compatible with both EventInterface and display needs
interface Event {
  id: number;
  title: string;
  description: string;
  latitude: string | number;
  longitude: string | number;
  address?: string | null;
  startTime: string | Date;
  endTime?: string | Date | null;
  category: string;
  secondaryCategory?: string | null;
  isPaid: boolean;
  price?: string | number | null;
  maxParticipants?: number | null;
  imageUrl?: string | null;
  isHighlighted?: boolean;
  highlightPriority?: number | null;
  distance?: number;
  externalUrl?: string | null;
  externalPageOpens?: number;
  savesCount?: number;
}

interface UserLocation {
  lat: number;
  lng: number;
}

// Simple date formatter - handles both string and Date
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
  events: Event[]; // All events for navigation
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  userLocation?: UserLocation;
  onAuthRequired?: () => void;
}

export function EventDetailPanel({ 
  event, 
  events, 
  onClose,
  onPrevious,
  onNext,
  userLocation,
  onAuthRequired 
}: EventDetailPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check if event is favorited or user is participating
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

  // State voor interacties
  const [showFullDescription, setShowFullDescription] = React.useState(false);
  const [showDetailMap, setShowDetailMap] = React.useState(false);
  const [swipeHintVisible, setSwipeHintVisible] = React.useState(true);

  // Track detail view when panel opens
  React.useEffect(() => {
    const trackView = async () => {
      try {
        await fetch(`/api/events/${event.id}/track-view`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
      } catch (error) {
        // Silently fail - tracking is not critical
      }
    };
    trackView();
  }, [event.id]);

  // Fetch event sources (multiple sources from different feeds)
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

  // Toggle favorite mutation
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
      toast({
        title: isFavorited ? "Verwijderd uit opgeslagen" : "Toegevoegd aan opgeslagen",
        description: isFavorited ? "Het evenement is verwijderd uit je opgeslagen events." : "Je ontvangt notificaties voor wijzigingen en herinneringen.",
      });
    },
    onError: () => {
      toast({
        title: "Fout bij opslaan",
        description: "Er ging iets mis bij het opslaan van je favoriet.",
        variant: "destructive",
      });
    },
  });

  // Toggle participant mutation
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
        description: "Er ging iets mis bij het aanmelden voor dit evenement.",
        variant: "destructive",
      });
    },
  });

  const handleToggleFavorite = () => {
    if (!user) {
      if (onAuthRequired) {
        onAuthRequired();
      }
      return;
    }
    toggleFavoriteMutation.mutate();
  };

  const handleToggleParticipant = () => {
    if (!user) {
      if (onAuthRequired) {
        onAuthRequired();
      }
      return;
    }
    toggleParticipantMutation.mutate();
  };

  // State voor interstitial
  const [showInterstitial, setShowInterstitial] = useState(false);

  // Track and open external page mutation
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
      setShowInterstitial(true);
    }
  };

  const handleCloseInterstitial = () => {
    setShowInterstitial(false);
  };

  // Find current event index for navigation
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

  // Swipe detection
  const [touchStart, setTouchStart] = React.useState<number | null>(null);
  const [touchEnd, setTouchEnd] = React.useState<number | null>(null);
  const [swipeDirection, setSwipeDirection] = React.useState<'left' | 'right' | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && hasNext) {
      setSwipeDirection('left');
      setTimeout(() => {
        handleNext();
        setSwipeDirection(null);
      }, 200);
    }
    
    if (isRightSwipe && hasPrevious) {
      setSwipeDirection('right');
      setTimeout(() => {
        handlePrevious();
        setSwipeDirection(null);
      }, 200);
    }
  };

  // Hide swipe hint after first interaction
  React.useEffect(() => {
    if (swipeDirection) {
      setSwipeHintVisible(false);
    }
  }, [swipeDirection]);

  const openNavigationApp = () => {
    const lat = typeof event.latitude === 'number' ? event.latitude : parseFloat(event.latitude);
    const lng = typeof event.longitude === 'number' ? event.longitude : parseFloat(event.longitude);
    
    // Detecteer platform en open juiste navigatie app
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      // Voor mobiele apparaten: probeer native apps te openen
      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      const appleNavigationUrl = `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
      
      if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        // iOS: Apple Maps
        window.open(appleNavigationUrl, '_blank');
      } else {
        // Android: Google Maps
        window.open(googleMapsUrl, '_blank');
      }
    } else {
      // Voor desktop: Google Maps in browser
      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      window.open(googleMapsUrl, '_blank');
    }
  };

  return (
    <>
    {showInterstitial && event.externalUrl && (
      <ExternalLinkInterstitial
        externalUrl={event.externalUrl}
        eventTitle={event.title}
        onClose={handleCloseInterstitial}
        eventLat={Number(event.latitude)}
        eventLng={Number(event.longitude)}
        eventCategory={event.category}
        eventId={event.id}
      />
    )}
    <AnimatePresence>
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ 
          y: 0,
          x: swipeDirection === 'left' ? -20 : swipeDirection === 'right' ? 20 : 0 
        }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl overflow-y-auto"
        style={{ height: "75vh", zIndex: 9999 }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
      {/* Compact Header - Mobile Optimized */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10 shadow-sm">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handlePrevious}
              disabled={!hasPrevious}
              className="p-2 h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onClose}
              className="text-xs px-2 h-8"
            >
              Terug
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleNext}
              disabled={!hasNext}
              className="p-2 h-8 w-8"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="text-xs text-gray-500">
            {currentIndex + 1} van {events.length}
          </div>
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onClose}
            className="p-2 h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Swipe Hint Visualisatie */}
      {swipeHintVisible && (hasPrevious || hasNext) && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute top-20 left-0 right-0 flex justify-center z-20 pointer-events-none"
        >
          <div className="bg-black/70 text-white text-xs px-3 py-1 rounded-full flex items-center gap-2">
            {hasPrevious && <ArrowLeft className="h-3 w-3" />}
            <span>Swipe voor volgende event</span>
            {hasNext && <ArrowRight className="h-3 w-3" />}
          </div>
        </motion.div>
      )}

      {/* Mobile-Optimized Event Content */}
      <div className="pb-20"> {/* Padding voor fixed bottom actions */}
        {/* Compact Event Image - Minder hoog */}
        {event.imageUrl && (
          <div className="relative h-32 bg-gray-100">
            <img 
              src={event.imageUrl} 
              alt={event.title}
              className="w-full h-full object-cover"
            />
            {event.isHighlighted && (
              <div className="absolute top-3 left-3">
                <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs px-2 py-1">
                  Gesponsord
                </Badge>
              </div>
            )}
            {/* Quick actions overlay */}
            <div className="absolute top-3 right-3 flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="h-8 w-8 p-0 bg-white/90 hover:bg-white"
                onClick={handleToggleFavorite}
              >
                <Heart className={cn("h-4 w-4", isFavorited ? "fill-primary text-primary" : "text-primary")} />
              </Button>
            </div>
          </div>
        )}

        <div className="p-4 space-y-4">
          {/* Compact Title and Category */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <CategoryIcon 
                category={event.category} 
                className="h-5 w-5" 
              />
              <Badge variant="secondary" className="text-xs">
                {event.category}
              </Badge>
              {event.isHighlighted && (
                <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs">
                  Highlight
                </Badge>
              )}
            </div>
            
            <h1 className="text-xl font-bold text-gray-900 leading-tight">
              {event.title}
            </h1>
          </div>

          {/* Compact Event Info Cards */}
          <div className="space-y-3">
            {/* Date & Time Card - Alleen startdatum */}
            <Card className="p-3 bg-blue-50 border-blue-200">
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <div className="font-medium text-blue-900">
                    {formatDateTime(event.startTime)}
                  </div>
                </div>
              </div>
            </Card>

            {/* Location Card - met afstand */}
            {event.address && (
              <Card 
                className="p-3 bg-green-50 border-green-200 cursor-pointer hover:bg-green-100 transition-colors"
                onClick={() => setShowDetailMap(true)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <MapPin className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm text-green-900 truncate">{event.address}</span>
                      {event.distance !== undefined && (
                        <span className="text-xs text-green-700">
                          {event.distance.toFixed(1)} km afstand
                        </span>
                      )}
                    </div>
                  </div>
                  <Button 
                    onClick={(e) => {
                      e.stopPropagation();
                      openNavigationApp();
                    }}
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-green-700 hover:bg-green-100 flex-shrink-0"
                  >
                    <Navigation className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            )}

            {/* Additional Info */}
            <div className="flex flex-wrap gap-2">
              {event.maxParticipants && (
                <Badge variant="outline" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  Max {event.maxParticipants} deelnemers
                </Badge>
              )}

              {event.isPaid && event.price && (
                <Badge variant="outline" className="text-xs text-orange-700 border-orange-300">
                  <Euro className="h-3 w-3 mr-1" />
                  €{event.price}
                </Badge>
              )}
            </div>
          </div>

          {/* Compact Description */}
          {event.description && (
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-gray-900">
                Beschrijving
              </h3>
              <div className="text-sm text-gray-700 leading-relaxed">
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
                    className="h-auto p-0 text-blue-600 hover:text-blue-800 mt-1"
                  >
                    {showFullDescription ? 'Minder tonen' : 'Meer lezen'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Bottom Action Bar - Mobile Style - Helemaal onderaan */}
      <div className="fixed left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg" style={{ bottom: 0, zIndex: 10000 }}>
        <div className="flex gap-3">
          {event.externalUrl ? (
            eventSources.length > 1 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    className="flex-1 h-12"
                    data-testid="button-open-external-page"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Bekijk bron ({eventSources.length})
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  {eventSources.map((source) => (
                    <DropdownMenuItem 
                      key={source.id}
                      onClick={() => window.open(source.sourceUrl, '_blank', 'noopener,noreferrer')}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Globe className="h-4 w-4 text-gray-500" />
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
                className="flex-1 h-12"
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
              className="flex-1 h-12"
              onClick={handleToggleParticipant}
              variant={isParticipating ? "secondary" : "default"}
              disabled={toggleParticipantMutation.isPending}
              data-testid="button-participate"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {isParticipating ? 'Aangemeld' : 'Aanmelden'}
            </Button>
          )}
          
          <Button 
            variant="outline" 
            size="icon"
            className="h-12 w-12"
            onClick={handleToggleFavorite}
            disabled={toggleFavoriteMutation.isPending}
          >
            <Heart className={cn("h-5 w-5", isFavorited ? "fill-primary text-primary" : "text-primary")} />
          </Button>
          
          
          <ShareMenu 
            title={event.title}
            url={`${window.location.origin}/app/event/${event.id}`}
            description={event.description?.substring(0, 100)}
            variant="mobile"
            buttonSize="icon"
          />
        </div>
      </div>

      {/* Detail Kaart Overlay */}
      {showDetailMap && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-[10001] flex items-center justify-center p-4"
          onClick={() => setShowDetailMap(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Route Details</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetailMap(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              {/* Afstand Info */}
              {event.distance !== undefined && (
                <Card className="p-3 bg-blue-50 border-blue-200">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">Afstand</p>
                      <p className="text-lg font-bold text-blue-700">{event.distance.toFixed(1)} km</p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Geschatte reistijd */}
              {event.distance !== undefined && (
                <Card className="p-3 bg-green-50 border-green-200">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-900">Geschatte reistijd</p>
                      <div className="flex gap-3 text-sm text-green-700">
                        <span>🚗 {Math.ceil(event.distance * 2)} min</span>
                        <span>🚴 {Math.ceil(event.distance * 4)} min</span>
                        <span>🚶 {Math.ceil(event.distance * 12)} min</span>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Locatie info */}
              <div className="space-y-2">
                {userLocation && (
                  <div className="flex items-start gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full bg-blue-500 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">Jouw locatie</p>
                      <p className="text-xs text-gray-600">
                        {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="flex items-start gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full bg-red-500 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">Event locatie</p>
                    <p className="text-xs text-gray-600">{event.address}</p>
                  </div>
                </div>
              </div>

              {/* Navigatie button */}
              <Button
                className="w-full h-12"
                onClick={() => {
                  setShowDetailMap(false);
                  openNavigationApp();
                }}
              >
                <Navigation className="h-4 w-4 mr-2" />
                Open in Navigatie App
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
    </AnimatePresence>
    </>
  );
}