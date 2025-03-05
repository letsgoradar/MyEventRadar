import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Share2, MapPin, Clock, Euro, User } from "lucide-react";
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import TopNav from "@/components/Layout/TopNav";
import BottomNav from "@/components/Layout/BottomNav";
import type { Event } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";

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

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col">
        <TopNav />
        <div className="flex-1 p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (isError || !event) {
    return (
      <div className="h-screen flex flex-col">
        <TopNav />
        <div className="flex-1 p-4 flex items-center justify-center">
          <p className="text-muted-foreground">Evenement niet gevonden</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <TopNav />
      <div className="flex-1 overflow-auto pb-20">
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
                  {format(new Date(event.endTime), 'HH:mm', { locale: nl })}
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>Locatie</span>
              </div>
              <div className="h-[200px] rounded-lg overflow-hidden">
                <MapContainer
                  center={[Number(event.latitude), Number(event.longitude)]}
                  zoom={15}
                  className="h-full w-full"
                  zoomControl={false}
                >
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                  <Marker position={[Number(event.latitude), Number(event.longitude)]} />
                </MapContainer>
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
      <div className="fixed bottom-[76px] left-0 right-0 p-4 bg-white border-t">
        <Button className="w-full">
          {event.isPaid ? 'Koop tickets' : 'Registreren'}
        </Button>
      </div>
      <BottomNav />
    </div>
  );
}