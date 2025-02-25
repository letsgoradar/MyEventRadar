import { useEffect, useState } from "react";
import { MapContainer, TileLayer, useMap, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";
import { format } from "date-fns";
import L from "leaflet";
import { Badge } from "@/components/ui/badge";

interface Location {
  lat: number;
  lng: number;
}

// Default center of Netherlands and zoom level
const DEFAULT_CENTER: [number, number] = [52.1326, 5.2913];
const DEFAULT_ZOOM = 6; // Zoomed out to show ~175km radius
const DEFAULT_RADIUS = 175; // 175km radius

// Define custom icon for events
const eventIcon = L.divIcon({
  className: 'custom-event-icon',
  html: '<div class="w-4 h-4 bg-orange-500 rounded-full border-2 border-white shadow-lg"></div>'
});

function MapController({ center }: { center: Location }) {
  const map = useMap();

  useEffect(() => {
    map.setView([center.lat, center.lng], map.getZoom());
  }, [center, map]);

  return null;
}

export default function MapView() {
  const [userLocation, setUserLocation] = useState<Location>({ 
    lat: DEFAULT_CENTER[0], 
    lng: DEFAULT_CENTER[1] 
  });
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [searchRadius, setSearchRadius] = useState(DEFAULT_RADIUS);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setSearchRadius(10); // Reduce radius when zooming to user location
          setZoom(11);
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  }, []);

  const { data: events } = useQuery<Event[]>({
    queryKey: ["/api/events/nearby", userLocation.lat, userLocation.lng, searchRadius],
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: userLocation.lat.toString(),
        lng: userLocation.lng.toString(),
        radius: searchRadius.toString(),
      });
      const response = await fetch(`/api/events/nearby?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      return response.json();
    },
  });

  return (
    <div className="relative h-[calc(100vh-8rem)]">
      <div className="absolute inset-0 border-[5px] border-gray-200 rounded-lg overflow-hidden">
        <MapContainer
          center={[userLocation.lat, userLocation.lng]}
          zoom={zoom}
          className="h-full w-full relative z-[1]"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <MapController center={userLocation} />

          {/* Show search radius circle */}
          <Circle
            center={[userLocation.lat, userLocation.lng]}
            radius={searchRadius * 1000}
            pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.1 }}
          />

          {events?.map((event) => {
            const location = event.location as { lat: number; lng: number };
            return (
              <Marker
                key={event.id}
                position={[location.lat, location.lng]}
                icon={eventIcon}
              >
                <Popup>
                  <div className="p-2 min-w-[200px]">
                    <h3 className="font-bold text-lg mb-2">{event.title}</h3>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{event.category}</Badge>
                      {event.subcategory && (
                        <Badge variant="outline" className="bg-slate-50">
                          {event.subcategory}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      <p>{format(new Date(event.startTime), "PPP")}</p>
                      <p>
                        {format(new Date(event.startTime), "h:mm a")}
                        {event.endTime && ` - ${format(new Date(event.endTime), "h:mm a")}`}
                      </p>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}