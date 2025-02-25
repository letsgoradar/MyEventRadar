import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useQuery } from "@tanstack/react-query";
import L from 'leaflet';
import "leaflet/dist/leaflet.css";
import { useState, useEffect } from 'react';
import type { Event } from "@shared/schema";

const DEFAULT_CENTER: [number, number] = [52.1326, 5.2913];
const RADIUS = 30000;

// Create event icon using divIcon for better rendering
const eventIcon = L.divIcon({
  className: 'event-marker',
  html: '<div style="width: 16px; height: 16px; background-color: #f97316; border: 2px solid white; border-radius: 50%;"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

// Create location icon
const locationIcon = L.divIcon({
  className: 'location-marker',
  html: '<div style="width: 16px; height: 16px; background-color: #2196F3; border: 2px solid white; border-radius: 50%;"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8]
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

        <Marker position={userLocation} icon={locationIcon}>
          <Popup>Your location</Popup>
        </Marker>

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
                  {event.isPaid && <p>Price: €{event.price}</p>}
                  <p>Category: {event.category}</p>
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