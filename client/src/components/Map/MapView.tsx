import { useEffect, useState } from "react";
import { MapContainer, TileLayer, useMap, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";
import { format } from "date-fns";
import L from "leaflet";
import { Badge } from "@/components/ui/badge";
import EventCard from "@/components/Events/EventCard";

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
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

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

  console.log('Events data:', events);

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

          {events?.map((event) => (
            <Marker
              key={event.id}
              position={[Number(event.latitude), Number(event.longitude)]}
              icon={eventIcon}
              eventHandlers={{
                click: () => setSelectedEvent(event)
              }}
            />
          ))}
        </MapContainer>
      </div>

      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedEvent(null)}>
          <div className="max-w-xl w-full" onClick={e => e.stopPropagation()}>
            <EventCard event={selectedEvent} />
          </div>
        </div>
      )}
    </div>
  );
}