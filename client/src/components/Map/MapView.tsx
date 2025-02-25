import { useEffect, useState } from "react";
import { MapContainer, TileLayer, useMap, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";
import EventCard from "@/components/Events/EventCard";

interface Location {
  lat: number;
  lng: number;
}

// Default center of Netherlands and zoom level
const DEFAULT_CENTER: [number, number] = [51.7656, 5.5314]; // Center of Oss
const DEFAULT_ZOOM = 13;
const DEFAULT_RADIUS = 10; // 10km radius

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
        },
        (error) => {
          console.error("Error getting location:", error);
          // Keep default Oss center
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
      console.log('Fetching events with params:', params.toString());
      const response = await fetch(`/api/events/nearby?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      const data = await response.json();
      console.log('Fetched events:', data);
      return data;
    },
  });

  console.log('Current events data:', events);

  return (
    <div className="relative h-[calc(100vh-8rem)]">
      <div className="absolute inset-0 border-[5px] border-gray-200 rounded-lg overflow-hidden">
        <MapContainer
          center={[userLocation.lat, userLocation.lng]}
          zoom={zoom}
          className="h-full w-full"
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