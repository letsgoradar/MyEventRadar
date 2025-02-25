
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";
import L from 'leaflet';
import "leaflet/dist/leaflet.css";

// Default center of Netherlands (if user location not available)
const DEFAULT_CENTER: [number, number] = [52.1326, 5.2913];
const RADIUS = 30000; // 30km radius in meters

// Standard blue pin icon
const eventIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="8" fill="#f97316" stroke="white" stroke-width="2"/>
    </svg>
  `),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function MapLocator({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 11);
  }, [center, map]);
  return null;
}

export default function MapView() {
  const [userLocation, setUserLocation] = useState<[number, number]>(DEFAULT_CENTER);

  // Get user's location
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

  // Fetch nearby events
  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["events", "nearby", userLocation],
    queryFn: async () => {
      const [lat, lng] = userLocation;
      const response = await fetch(`/api/events/nearby?lat=${lat}&lng=${lng}&radius=${RADIUS}`);
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      return response.json();
    },
  });

  return (
    <div className="h-[calc(100vh-8rem)]">
      <MapContainer
        center={userLocation}
        zoom={11}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {events.map(event => {
          const lat = Number(event.latitude);
          const lng = Number(event.longitude);

          if (isNaN(lat) || isNaN(lng)) return null;

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
                </div>
              </Popup>
            </Marker>
          );
        })}

        <MapLocator center={userLocation} />
      </MapContainer>
    </div>
  );
}
