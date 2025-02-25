import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { MapContainer, TileLayer, Marker } from "react-leaflet"
import { Satellite } from "lucide-react"
import type { Event } from "@shared/schema"
import L from 'leaflet'
import "leaflet/dist/leaflet.css"
import "./Map/leaflet-fix.css"

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

async function getGeocodedCity(lat: number, lng: number): Promise<string | null> {
  try {
    const response = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
    if (!response.ok) {
      throw new Error('Failed to geocode location');
    }
    const data = await response.json();
    return data.city || null;
  } catch (error) {
    console.error("Error geocoding location:", error);
    return "Unknown location"; // Fallback text
  }
}


export function EventList() {
  const [userLocation, setUserLocation] = React.useState<[number, number]>([51.7656, 5.5314]); // Default to Oss
  const [isSatelliteView, setIsSatelliteView] = React.useState(false);

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

  const tileUrl = isSatelliteView
    ? "https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  const tileConfig = isSatelliteView
    ? { subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] }
    : { subdomains: 'abcd' };

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

        const city = getGeocodedCity(eventCoords[0], eventCoords[1]); 
        const locationDisplay = city ? `${event.location?.locationName || 'Location not specified'}, ${city}` : event.location?.locationName || 'Location not specified';

        return (
          <Card key={event.id} className="overflow-hidden">
            <CardContent className="p-6 grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-bold">{event.title}</h3>
                <div className="text-sm text-muted-foreground mt-2">
                  <p>{locationDisplay}</p>
                  <p>{format(new Date(event.startTime), 'PPP')}</p>
                  <p>{event.category}</p>
                  {event.isPaid && <p>Price: €{event.price}</p>}
                </div>
              </div>
              <div className="relative h-32 bg-muted rounded">
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute top-2 right-2 z-[1000] bg-white/90 hover:bg-white"
                  onClick={() => setIsSatelliteView(!isSatelliteView)}
                  title={isSatelliteView ? "Switch to Map View" : "Switch to Satellite View"}
                >
                  <Satellite className={`h-4 w-4 ${isSatelliteView ? 'text-primary' : 'text-muted-foreground'}`} />
                </Button>
                <MapContainer
                  center={eventCoords}
                  zoom={14}
                  className="h-full w-full rounded"
                  zoomControl={false}
                  dragging={false}
                  touchZoom={false}
                  doubleClickZoom={false}
                  scrollWheelZoom={false}
                  attributionControl={false}
                >
                  <TileLayer
                    url={tileUrl}
                    attribution={false}
                    {...tileConfig}
                  />
                  <Marker position={eventCoords} icon={miniEventIcon} />
                </MapContainer>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}