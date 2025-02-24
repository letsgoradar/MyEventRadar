import { useEffect, useState } from "react";
import { MapContainer, TileLayer, useMap, Marker, Popup, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";
import LocationPin from "./LocationPin";
import EventOverlay from "./EventOverlay";
import { format } from "date-fns";
import L from "leaflet";

interface Location {
  lat: number;
  lng: number;
}

// Define custom icon for events
const eventIcon = L.divIcon({
  className: 'custom-event-icon',
  html: '<div class="w-4 h-4 bg-orange-500 rounded-full border-2 border-white shadow-lg"></div>'
});

function MapController({ center }: { center: Location }) {
  const map = useMap();

  useEffect(() => {
    map.setView([center.lat, center.lng], 11);
  }, [center, map]);

  return null;
}

export default function MapView() {
  const [userLocation, setUserLocation] = useState<Location>({ lat: 51.9225, lng: 4.47917 }); // Default to Rotterdam
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [searchRadius, setSearchRadius] = useState(10); // 10km radius

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      });
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
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setSelectedEvent(null)} />
      )}
      <MapContainer
        center={[userLocation.lat, userLocation.lng]}
        zoom={11}
        className="h-full w-full relative z-[1]"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MapController center={userLocation} />
        <LocationPin />

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
              eventHandlers={{
                click: () => setSelectedEvent(event),
              }}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-bold text-lg">{event.title}</h3>
                  <p className="text-sm text-gray-600">{format(new Date(event.startTime), 'PPP')}</p>
                  <p className="text-sm">{event.description}</p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {selectedEvent && (
        <EventOverlay
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}