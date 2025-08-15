import React from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, X, Calendar, MapPin, Users, Euro, Clock, Share2, Heart, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div className="w-full h-full bg-white flex flex-col">
      {/* Navigation Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handlePrevious}
            disabled={!hasPrevious}
            className="p-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={onClose}
            className="px-4"
          >
            Terug naar overzicht
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleNext}
            disabled={!hasNext}
            className="p-2"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        
        <Button 
          variant="ghost" 
          size="sm"
          onClick={onClose}
          className="p-2"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Event Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Event Image */}
        {event.imageUrl && (
          <div className="relative h-64 bg-gray-100">
            <img 
              src={event.imageUrl} 
              alt={event.title}
              className="w-full h-full object-cover"
            />
            {event.isHighlighted && (
              <div className="absolute top-4 left-4">
                <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">
                  Gesponsord
                </Badge>
              </div>
            )}
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* Title and Category */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <CategoryIcon 
                category={event.category} 
                className="h-6 w-6" 
              />
              <Badge variant="secondary">
                {event.category}
              </Badge>
              {event.isHighlighted && (
                <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">
                  Highlight
                </Badge>
              )}
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900">
              {event.title}
            </h1>
          </div>

          {/* Event Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-gray-600">
              <Calendar className="h-5 w-5 flex-shrink-0" />
              <div>
                <div className="font-medium">
                  {formatDateTime(event.startTime)}
                </div>
                {event.endTime && (
                  <div className="text-sm text-gray-500">
                    tot {formatDateTime(event.endTime)}
                  </div>
                )}
              </div>
            </div>

            {event.address && (
              <div className="flex items-center gap-3 text-gray-600">
                <MapPin className="h-5 w-5 flex-shrink-0" />
                <span>{event.address}</span>
              </div>
            )}

            {event.maxParticipants && (
              <div className="flex items-center gap-3 text-gray-600">
                <Users className="h-5 w-5 flex-shrink-0" />
                <span>Maximaal {event.maxParticipants} deelnemers</span>
              </div>
            )}

            {event.isPaid && event.price && (
              <div className="flex items-center gap-3 text-gray-600">
                <Euro className="h-5 w-5 flex-shrink-0" />
                <span>€{event.price}</span>
              </div>
            )}
          </div>

          {/* Description */}
          {event.description && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Beschrijving
              </h3>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-4">
            <Button 
              className="flex-1"
              asChild
            >
              <Link href={`/web/event/${event.id}`}>
                <UserPlus className="h-4 w-4 mr-2" />
                Deelnemen
              </Link>
            </Button>
            
            <Button variant="outline">
              <Heart className="h-4 w-4 mr-2" />
              Favoriet
            </Button>
            
            <Button variant="outline">
              <Share2 className="h-4 w-4 mr-2" />
              Delen
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}