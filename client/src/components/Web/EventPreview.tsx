import React from "react";
import { Calendar, MapPin, Users, Euro, Eye, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import CategoryIcon from "@/components/Events/CategoryIcon";

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
  const utcH = date.getUTCHours(), utcM = date.getUTCMinutes(), utcS = date.getUTCSeconds();
  const isDateOnly = (utcH === 0 && utcM === 0 && utcS === 0) || (utcH === 23 && utcM === 59 && utcS === 59);
  if (isDateOnly) {
    return date.toLocaleDateString('nl-NL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }
  return date.toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  });
};

interface EventPreviewProps {
  event: Event;
  onViewDetails: () => void;
  onClose: () => void;
}

export function EventPreview({ event, onViewDetails, onClose }: EventPreviewProps) {
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
    <Card className="m-4 shadow-lg border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
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
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            ×
          </Button>
        </div>
        
        <CardTitle className="text-xl">
          {event.title}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Event Image Preview */}
        {event.imageUrl && (
          <div className="relative h-32 bg-gray-100 rounded-md overflow-hidden">
            <img 
              src={event.imageUrl} 
              alt={event.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Event Info */}
        <div className="space-y-3">
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <Calendar className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">
                {formatDateTime(event.startTime)}
              </div>
              {event.endTime && (
                <div className="text-xs text-gray-500">
                  tot {formatDateTime(event.endTime)}
                </div>
              )}
            </div>
          </div>

          {event.address && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{event.address}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            {event.maxParticipants && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="h-4 w-4 flex-shrink-0" />
                <span>Max {event.maxParticipants}</span>
              </div>
            )}

            {event.isPaid && event.price && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Euro className="h-4 w-4 flex-shrink-0" />
                <span>€{event.price}</span>
              </div>
            )}
          </div>
        </div>

        {/* Description Preview */}
        {event.description && (
          <p className="text-sm text-gray-700 line-clamp-3">
            {event.description}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button 
            onClick={onViewDetails}
            className="flex-1"
            size="sm"
          >
            <Eye className="h-4 w-4 mr-2" />
            Bekijk details
          </Button>
          
          <Button 
            onClick={openNavigationApp}
            variant="outline"
            size="sm"
            className="flex-shrink-0"
            title="Navigeer naar locatie"
          >
            <Navigation className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}