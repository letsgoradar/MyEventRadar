
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";
import L from 'leaflet';
import "leaflet/dist/leaflet.css";

// Custom marker icons
const userIcon = L.divIcon({
  html: `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="8" fill="#2196F3" stroke="white" stroke-width="2"/>
    </svg>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const eventIcon = L.divIcon({
  html: `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="8" fill="#f97316" stroke="white" stroke-width="2"/>
    </svg>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Map location updater component
function MapLocator({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function MapView() {
  const [userLocation, setUserLocation] = useState<[number, number]>([51.7656, 5.5314]);
  const [zoom] = useState(13);

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
      console.log('Fetching events with params:', { lat, lng, radius: 10 });
      const response = await fetch(`/api/events/nearby?lat=${lat}&lng=${lng}&radius=10`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    },
  });

  // Filter and format events
  const validEvents = events.filter(event => {
    const lat = Number(event.latitude);
    const lng = Number(event.longitude);
    return !isNaN(lat) && !isNaN(lng);
  });

  console.log('Found events:', validEvents.length);

  return (
    <div className="h-[calc(100vh-8rem)]">
      <MapContainer
        center={userLocation}
        zoom={zoom}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* User location marker */}
        <Marker position={userLocation} icon={userIcon}>
          <Popup>Your location</Popup>
        </Marker>

        {/* Event markers */}
        {validEvents.map(event => {
          const coordinates: [number, number] = [
            Number(event.latitude),
            Number(event.longitude)
          ];
          
          return (
            <Marker
              key={event.id}
              position={coordinates}
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
