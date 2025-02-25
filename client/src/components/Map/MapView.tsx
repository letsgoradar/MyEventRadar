import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";
import "leaflet/dist/leaflet.css";

// Center of Oss
const DEFAULT_CENTER: [number, number] = [51.7656, 5.5314];

export default function MapView() {
  // State for user location
  const [userLocation, setUserLocation] = useState<[number, number]>(DEFAULT_CENTER);

  // Get user location
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation: [number, number] = [position.coords.latitude, position.coords.longitude];
          console.log('User location:', newLocation); // Debug log
          setUserLocation(newLocation);
        },
        (error) => {
          console.error("Location error:", error);
        }
      );
    }
  }, []);

  // Fetch events
  const { data: events } = useQuery<Event[]>({
    queryKey: ["/api/events/nearby"],
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: DEFAULT_CENTER[0].toString(),
        lng: DEFAULT_CENTER[1].toString(),
        radius: "10" // 10km radius
      });

      const response = await fetch(`/api/events/nearby?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      const data = await response.json();
      console.log('Raw events data:', data); // Debug log
      return data;
    }
  });

  // Debug log for comparison
  useEffect(() => {
    if (events) {
      console.log('User marker format:', userLocation);
      events.forEach(event => {
        const eventLocation: [number, number] = [Number(event.latitude), Number(event.longitude)];
        console.log('Event marker format:', event.title, eventLocation);
      });
    }
  }, [events, userLocation]);

  return (
    <div style={{ height: "calc(100vh - 8rem)" }}>
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {/* User location marker */}
        <Marker position={userLocation}>
          <Popup>You are here</Popup>
        </Marker>

        {/* Event markers */}
        {events && events.map(event => {
          // Convert string coordinates to numbers and ensure they're valid
          const lat = Number(event.latitude);
          const lng = Number(event.longitude);

          if (isNaN(lat) || isNaN(lng)) {
            console.error('Invalid coordinates for event:', event.title, lat, lng);
            return null;
          }

          console.log('Adding event marker:', event.title, [lat, lng]); // Debug log

          return (
            <Marker
              key={event.id}
              position={[lat, lng]}
            >
              <Popup>
                <h3 className="font-bold">{event.title}</h3>
                <p>{event.description}</p>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}