import React from "react";
import { ArrowLeft, ArrowRight, X, Calendar, MapPin, Users, Euro, Clock, Share2, Heart, UserPlus, Navigation, Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import CategoryIcon from "@/components/Events/CategoryIcon";
import { motion, AnimatePresence } from "framer-motion";

// Define Event type inline for now
interface Event {
  id: number;
  title: string;
  description: string;
  latitude: string;
  longitude: string;
  address?: string | null;
  startTime: string;
  endTime?: string | null;
  category: string;
  secondaryCategory?: string | null;
  isPaid: boolean;
  price?: string | null;
  maxParticipants?: number | null;
  imageUrl?: string | null;
  isHighlighted?: boolean;
  highlightPriority?: number | null;
}

// Simple date formatter
const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
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
}

export function EventDetailPanel({ 
  event, 
  events, 
  onClose,
  onPrevious,
  onNext 
}: EventDetailPanelProps) {
  // State voor interacties
  const [isParticipating, setIsParticipating] = React.useState(false);
  const [isFavorited, setIsFavorited] = React.useState(false);
  const [showFullDescription, setShowFullDescription] = React.useState(false);

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

  const openNavigationApp = () => {
    const lat = parseFloat(event.latitude);
    const lng = parseFloat(event.longitude);
    
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
    <AnimatePresence>
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl overflow-y-auto"
        style={{ height: "75vh" }}
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

      {/* Mobile-Optimized Event Content */}
      <div className="pb-32"> {/* Extra padding for fixed bottom actions (above bottom nav) */}
        {/* Compact Event Image */}
        {event.imageUrl && (
          <div className="relative h-48 bg-gray-100">
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
                onClick={() => setIsFavorited(!isFavorited)}
              >
                {isFavorited ? 
                  <BookmarkCheck className="h-4 w-4 text-blue-600" /> : 
                  <Bookmark className="h-4 w-4" />
                }
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
            {/* Date & Time Card */}
            <Card className="p-3 bg-blue-50 border-blue-200">
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <div className="font-medium text-blue-900">
                    {formatDateTime(event.startTime)}
                  </div>
                  {event.endTime && (
                    <div className="text-xs text-blue-700">
                      tot {formatDateTime(event.endTime)}
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Location Card */}
            {event.address && (
              <Card className="p-3 bg-green-50 border-green-200">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <MapPin className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span className="text-sm text-green-900 truncate">{event.address}</span>
                  </div>
                  <Button 
                    onClick={openNavigationApp}
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
                  <p className="line-clamp-3">{event.description}</p>
                )}
                {event.description.length > 150 && (
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

      {/* Fixed Bottom Action Bar - Mobile Style - Above Bottom Nav */}
      <div className="fixed left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg" style={{ bottom: "56px" }}>
        <div className="flex gap-3">
          <Button 
            className="flex-1 h-12"
            onClick={() => {
              setIsParticipating(!isParticipating);
              console.log('Deelname status gewijzigd:', event.id, !isParticipating);
            }}
            variant={isParticipating ? "secondary" : "default"}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            {isParticipating ? 'Aangemeld' : 'Deelnemen'}
          </Button>
          
          <Button 
            variant="outline" 
            size="icon"
            className="h-12 w-12"
            onClick={() => {
              setIsFavorited(!isFavorited);
              console.log('Favoriet status gewijzigd:', event.id, !isFavorited);
            }}
          >
            {isFavorited ? 
              <BookmarkCheck className="h-5 w-5 text-blue-600" /> : 
              <Bookmark className="h-5 w-5" />
            }
          </Button>
          
          <Button 
            variant="outline" 
            size="icon"
            className="h-12 w-12"
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: event.title,
                  text: event.description,
                  url: window.location.href
                });
              } else {
                console.log('Delen van event:', event.id);
              }
            }}
          >
            <Share2 className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </motion.div>
    </AnimatePresence>
  );
}