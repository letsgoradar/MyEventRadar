import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useQuery } from "@tanstack/react-query";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useState, useEffect } from 'react';
import type { Event } from "@shared/schema";

const DEFAULT_CENTER: [number, number] = [51.7656, 5.5314];
const RADIUS = 10;

// Create event icon outside component to prevent recreation
const eventIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="8" fill="#f97316" stroke="white" stroke-width="2"/>
    </svg>
  `),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12]
});

const locationIcon = L.divIcon({
  className: 'location-marker',
  html: '<div style="width: 16px; height: 16px; background-color: #2196F3; border: 2px solid white; border-radius: 50%;"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

export default function MapView() {
  const [userLocation, setUserLocation] = useState<[number, number]>(DEFAULT_CENTER);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  }, []);

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["events", "nearby", userLocation],
    queryFn: async () => {
      const [lat, lng] = userLocation;
      const response = await fetch(`/api/events/nearby?lat=${lat}&lng=${lng}&radius=${RADIUS}`);
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    },
  });

  return (
    <div className="h-[calc(100vh-8rem)] relative">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={12}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {events.map((event) => {
          // Safely extract coordinates
          const lat = Number(event.latitude);
          const lng = Number(event.longitude);

          if (isNaN(lat) || isNaN(lng)) {
            console.warn(`Invalid coordinates for event ${event.id}`);
            return null;
          }

          return (
            <Marker
              key={event.id}
              position={[lat, lng]}
              icon={eventIcon}
            >
              <Popup>
                <div className="text-sm">
                  <h3 className="font-bold">{event.title}</h3>
                  <p>{event.description}</p>
                  {event.isPaid && <p>Price: €{event.price}</p>}
                  <p>Category: {event.category}</p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}