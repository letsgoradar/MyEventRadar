import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Share2, MapPin, Clock, Euro, User, Eye } from "lucide-react";
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import type { Event } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";
import StreetView from "@/components/StreetView/StreetView";
import { useState } from "react";
import FocusLayout from "@/components/Layout/FocusLayout";

export default function EventDetailPage() {
  const params = useParams();
  const eventId = params.id;

  const { data: event, isLoading, isError } = useQuery<Event>({
    queryKey: [`/api/events/${eventId}`],
    queryFn: async () => {
      const response = await fetch(`/api/events/${eventId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch event');
      }
      return response.json();
    },
    enabled: !!eventId,
    retry: 1,
  });

  const [showStreetView, setShowStreetView] = useState(false);

  if (isLoading) {
    return (
      <FocusLayout>
        <div className="p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </FocusLayout>
    );
  }

  if (isError || !event) {
    return (
      <FocusLayout>
        <div className="p-4 flex items-center justify-center">
          <p className="text-muted-foreground">Evenement niet gevonden</p>
        </div>
      </FocusLayout>
    );
  }

  return (
    <FocusLayout>
      <div className="space-y-4">
        {/* Header Section */}
        <div className="p-4 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{event.title}</h1>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="capitalize">
                  {event.category}
                </Badge>
                {event.subcategory && (
                  <Badge variant="outline" className="capitalize">
                    {event.subcategory}
                  </Badge>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0">
              <Share2 className="h-5 w-5" />
            </Button>
          </div>

          {/* Event Details */}
          <div className="space-y-4">
            {/* Date & Time */}
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <div>{format(new Date(event.startTime), 'EEEE d MMMM yyyy', { locale: nl })}</div>
                <div className="text-muted-foreground">
                  {format(new Date(event.startTime), 'HH:mm', { locale: nl })} - 
                  {event.endTime && format(new Date(event.endTime), 'HH:mm', { locale: nl })}
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium">Locatie</h3>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 px-3"
                  onClick={() => setShowStreetView(!showStreetView)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {showStreetView ? 'Toon kaart' : 'Toon locatie'}
                </Button>
              </div>

              <div className="relative h-60 bg-muted rounded-md overflow-hidden shadow-lg">
                {showStreetView ? (
                  <StreetView 
                    latitude={Number(event.latitude)} 
                    longitude={Number(event.longitude)} 
                  />
                ) : (
                  <MapContainer
                    center={[Number(event.latitude), Number(event.longitude)]}
                    zoom={15}
                    className="h-full w-full"
                    zoomControl={false}
                  >
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                    <Marker position={[Number(event.latitude), Number(event.longitude)]} />
                  </MapContainer>
                )}
              </div>
            </div>

            {/* Price */}
            {event.isPaid && (
              <div className="flex items-center gap-2 text-sm">
                <Euro className="h-4 w-4 text-muted-foreground" />
                <span>{formatCurrency(event.price || 0)}</span>
              </div>
            )}

            {/* Host */}
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>Georganiseerd door {event.hostId}</span>
            </div>

            {/* Description */}
            <div className="mt-6">
              <h2 className="text-lg font-semibold mb-2">Over dit evenement</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Action */}
      <div className="sticky bottom-0 p-4 bg-white border-t">
        <Button className="w-full">
          {event.isPaid ? 'Koop tickets' : 'Registreren'}
        </Button>
      </div>
    </FocusLayout>
  );
}