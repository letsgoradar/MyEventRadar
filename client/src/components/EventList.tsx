
import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { MapContainer, TileLayer, Marker } from "react-leaflet"
import type { Event } from "@shared/schema"
import L from 'leaflet'
import "leaflet/dist/leaflet.css"

// Custom icon for the mini map marker
const miniEventIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="8" fill="#f97316" stroke="white" stroke-width="2"/>
    </svg>
  `),
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c * 10) / 10;
}

export function EventList() {
  const [userLocation, setUserLocation] = React.useState<[number, number]>([51.7656, 5.5314]); // Default to Oss

  React.useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        }
      );
    }
  }, []);

  const { data: events, isLoading, error } = useQuery<Event[]>({
    queryKey: ['/api/events/nearby'],
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: userLocation[0].toString(),
        lng: userLocation[1].toString(),
        radius: '10'
      });
      const response = await fetch(`/api/events/nearby?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      return response.json();
    }
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-32 bg-muted rounded mt-4"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-red-500">Error loading events. Please try again.</div>;
  }

  return (
    <div className="p-4 space-y-4 overflow-auto max-h-[calc(100vh-16rem)]">
      {events?.map((event) => {
        const eventCoords = event.location 
          ? [event.location.lat, event.location.lng] 
          : [Number(event.latitude), Number(event.longitude)];
        
        const distance = calculateDistance(
          userLocation[0], 
          userLocation[1], 
          eventCoords[0], 
          eventCoords[1]
        );

        return (
          <Card key={event.id} className="overflow-hidden">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">{event.title}</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="h-[200px] rounded-md overflow-hidden">
                    <MapContainer
                      center={eventCoords as [number, number]}
                      zoom={14}
                      className="h-full w-full"
                      zoomControl={false}
                      dragging={false}
                      touchZoom={false}
                      doubleClickZoom={false}
                      scrollWheelZoom={false}
                      attributionControl={false}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <Marker position={eventCoords as [number, number]} icon={miniEventIcon} />
                    </MapContainer>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>{event.location?.locationName || 'Location not specified'}</p>
                    <p>{distance} km away</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{event.category}</Badge>
                    {event.subcategory && (
                      <Badge variant="outline" className="bg-slate-50">
                        {event.subcategory}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm">{format(new Date(event.startTime), 'PPP')}</p>
                  {event.isPaid && event.price && (
                    <p className="text-sm font-semibold">€{Number(event.price).toFixed(2)}</p>
                  )}
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
