import * as React from "react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { App2Layout } from "@/components/App2/App2Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  Clock,
  MapPin,
  Users,
  ChevronLeft,
  Heart,
  Share2,
  AlertCircle,
} from "lucide-react";
import { CategoryIcon, getCategoryColor } from "@/components/CategoryIcon";
import { formatDistanceToNow, format, differenceInHours } from "date-fns";
import { nl } from "date-fns/locale";
import { apiRequest } from "@/lib/api";
import { Event } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import 'leaflet/dist/leaflet.css';
import { getLocationName } from "@/utils/location-utils";

export function App2EventDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const eventId = parseInt(id);
  
  // Haal de returnTo parameter uit de URL
  const [returnTo, setReturnTo] = useState('/app2');
  
  useEffect(() => {
    // Parse de URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const returnParam = urlParams.get('returnTo');
    if (returnParam) {
      setReturnTo(returnParam);
    }
  }, []);

  const { data: event, isLoading, error } = useQuery<Event>({
    queryKey: [`/api/events/${eventId}`],
    enabled: !isNaN(eventId),
  });

  if (isLoading) {
    return (
      <App2Layout title="Evenement">
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
      </App2Layout>
    );
  }

  if (error || !event) {
    return (
      <App2Layout title="Evenement niet gevonden">
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
      </App2Layout>
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
    <App2Layout title={event.title}>
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
                  {event.tags.map((tag, i) => (
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
    </App2Layout>
  );
}

export default App2EventDetail;