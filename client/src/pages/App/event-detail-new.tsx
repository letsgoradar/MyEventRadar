import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Calendar, 
  Clock, 
  Euro, 
  Map as MapIcon, 
  Users, 
  Heart, 
  Share, 
  MessageCircle, 
  ChevronLeft,
  MapPin,
  ArrowLeft,
  Search,
  ChevronRight,
  AlertCircle,
  Share2,
  CalendarDays,
  User
} from 'lucide-react';
import { EventInterface } from '@shared/schema';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { CategoryIcon, getCategoryColor } from '@/components/CategoryIcon';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import 'leaflet/dist/leaflet.css';
import '@/components/Events/leaflet-fix.css';
import { getLocationName } from '@/utils/location-utils';
import { format, formatDistanceToNow, differenceInHours } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Importeer L van leaflet
import L from 'leaflet';

// Nodig voor het Marker icoon
function createEventIcon(category: string) {
  const color = getCategoryColor(category as any);
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; display: flex; justify-content: center; align-items: center;">
            <svg width="16" height="16" viewBox="0 0 24 24" style="color: white">
              ${getCategoryIconPath(category)}
            </svg>
           </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
}

function getCategoryIconPath(category: string): string {
  // Default path (just a circle if no matching icon is found)
  let path = '<circle cx="12" cy="12" r="10" />';
  
  // You would replace this with actual SVG paths for your categories
  switch(category) {
    case 'Sport en spel':
      path = '<path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z"/> <path d="m8 18 4-4 4 4"/> <path d="m8 6 4 4 4-4"/>';
      break;
    case 'Muziek':
      path = '<circle cx="12" cy="12" r="10"/> <path d="M9 17V7l8 5-8 5Z"/>';
      break;
    // Add more cases as needed
  }
  
  return path;
}

export function AppEventDetailNew() {
  const params = useParams();
  const eventId = params.id;
  const [, navigate] = useLocation();
  
  // Haal de returnTo waarde uit de URL query string
  const query = new URLSearchParams(window.location.search);
  const returnTo = query.get('returnTo') || '/app';
  
  const { data: event, error, isLoading } = useQuery<EventInterface>({
    queryKey: [`/api/events/${eventId}`],
    enabled: !!eventId,
  });
  
  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-48 bg-gray-200 rounded-md" />
          <div className="h-8 bg-gray-200 rounded-md w-3/4" />
          <div className="h-4 bg-gray-200 rounded-md w-1/2" />
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded-md" />
            <div className="h-4 bg-gray-200 rounded-md" />
            <div className="h-4 bg-gray-200 rounded-md w-5/6" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">Evenement niet gevonden</h2>
          <p className="text-muted-foreground mb-6">
            Het opgevraagde evenement bestaat niet of is niet meer beschikbaar.
          </p>
          <Button asChild>
            <Link href={returnTo}>Terug naar overzicht</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Bereken countdown en bepaal urgentie
  const now = new Date();
  const startTime = new Date(event.startTime);
  const endTime = event.endTime ? new Date(event.endTime) : new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // Default 2 uur
  const isEventActive = now >= startTime && now <= endTime;
  const isEventPast = now > endTime;
  const hoursToEvent = differenceInHours(startTime, now);
  const isUrgent = hoursToEvent > 0 && hoursToEvent < 12;

  // Bepaal hoe lang het evenement duurt
  const durationHours = differenceInHours(endTime, startTime);
  
  // Formatteer data voor weergave
  const formattedDate = format(startTime, "EEEE d MMMM yyyy", { locale: nl });
  const formattedStartTime = format(startTime, "HH:mm", { locale: nl });
  const formattedEndTime = format(endTime, "HH:mm", { locale: nl });
  
  const timeAgo = formatDistanceToNow(startTime, { addSuffix: true, locale: nl });

  // Beheerder functie voor het bewerken van een evenement
  const handleEdit = () => {
    navigate(`/admin/events/edit/${eventId}`);
  };

  // Component voor de evenement locatie op een kaart
  const EventLocation = ({ lat, lng }: { lat: number; lng: number }) => {
    return (
      <div className="h-[200px] w-full rounded-md overflow-hidden mb-6">
        <MapContainer 
          center={[lat, lng]} 
          zoom={14} 
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[lat, lng]} />
        </MapContainer>
      </div>
    );
  };

  // Component voor de afbeeldingengalerij
  const ImageGallery = ({ imageUrls }: { imageUrls: string[] }) => {
    if (!imageUrls || imageUrls.length === 0) return null;
    
    return (
      <div className="mb-6">
        <div className="relative h-64 w-full rounded-md overflow-hidden">
          <img 
            src={imageUrls[0]} 
            alt={event.title} 
            className="w-full h-full object-cover"
          />
          {imageUrls.length > 1 && (
            <div className="absolute bottom-2 right-2 bg-black/50 text-white px-2 py-1 rounded-md text-xs">
              +{imageUrls.length - 1} foto's
            </div>
          )}
        </div>
        
        {imageUrls.length > 1 && (
          <div className="grid grid-cols-4 gap-2 mt-2">
            {imageUrls.slice(1, 5).map((url, idx) => (
              <div key={idx} className="aspect-square rounded-md overflow-hidden">
                <img 
                  src={url} 
                  alt={`${event.title} afbeelding ${idx + 2}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Voorbereiden van de juiste data voor weergave
  const eventImages = [event.imageUrl].filter(Boolean) as string[];
  
  return (
    <div className="pb-20">
      <div className="sticky top-0 bg-background z-10 flex items-center justify-between p-4 border-b">
        <Button variant="ghost" size="icon" asChild>
          <Link href={returnTo}>
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Heart className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Share2 className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="p-4">
        <ImageGallery imageUrls={eventImages} />
        
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold mb-1">{event.title}</h1>
            
            <div className="flex items-center gap-2 mb-4">
              {event.category && (
                <Badge 
                  className="gap-1 items-center"
                  style={{ backgroundColor: getCategoryColor(event.category as any) }}
                >
                  <CategoryIcon category={event.category as any} size={12} className="text-white" />
                  <span>{event.category}</span>
                </Badge>
              )}
              {isEventActive && (
                <Badge variant="outline" className="bg-green-500/10 text-green-600 hover:bg-green-500/10">Nu bezig</Badge>
              )}
              {isEventPast && (
                <Badge variant="outline" className="bg-gray-500/10 text-gray-600 hover:bg-gray-500/10">Afgelopen</Badge>
              )}
              {!isEventActive && !isEventPast && isUrgent && (
                <Badge variant="outline" className="bg-red-500/10 text-red-600 hover:bg-red-500/10">Binnenkort</Badge>
              )}
            </div>
          </div>
          
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{formattedDate}</p>
                  <p className="text-sm text-muted-foreground">{timeAgo}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{formattedStartTime} - {formattedEndTime}</p>
                  <p className="text-sm text-muted-foreground">
                    {durationHours <= 24 
                      ? `${durationHours} uur` 
                      : `${Math.floor(durationHours / 24)} dagen en ${durationHours % 24} uur`}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{getLocationName(Number(event.latitude), Number(event.longitude))}</p>
                  <p className="text-sm text-muted-foreground">{event.address || "Geen adresgegevens beschikbaar"}</p>
                </div>
              </div>
              
              {event.maxParticipants && Number(event.maxParticipants) > 0 && (
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Maximaal {event.maxParticipants} deelnemers</p>
                    <p className="text-sm text-muted-foreground">
                      0 aangemeld
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {event.latitude && event.longitude && (
            <EventLocation lat={Number(event.latitude)} lng={Number(event.longitude)} />
          )}
          
          <div>
            <h2 className="text-xl font-bold mb-3">Beschrijving</h2>
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-line">{event.description}</p>
            </div>
          </div>
          
          {event.tags && event.tags.length > 0 && (
            <div>
              <h2 className="text-xl font-bold mb-3">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {event.tags.map((tag: string, i: number) => (
                  <Badge key={i} variant="secondary">{tag}</Badge>
                ))}
              </div>
            </div>
          )}
          
          <div className="pt-6">
            <Button className="w-full" size="lg">
              Deelnemen
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AppEventDetailNew;