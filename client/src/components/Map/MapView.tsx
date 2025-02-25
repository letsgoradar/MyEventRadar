
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER: [number, number] = [52.1326, 5.2913];
const RADIUS = 30000;

// Create event icon
const eventIcon = L.divIcon({
  className: 'custom-event-marker',
  html: '<div style="background-color: #f97316; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white;"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// Create location icon
const locationIcon = L.divIcon({
  className: 'custom-location-marker',
  html: '<div style="background-color: #2196F3; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white;"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function MapLocator({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

export default function MapView() {
  const [userLocation, setUserLocation] = useState<[number, number]>(DEFAULT_CENTER);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation: [number, number] = [position.coords.latitude, position.coords.longitude];
          console.log("User location set:", newLocation);
          setUserLocation(newLocation);
        },
        (error) => {
          console.error("Geolocation error:", error);
        }
      );
    }
  }, []);

  // Fetch events
  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["events", "nearby", userLocation],
    queryFn: async () => {
      const [lat, lng] = userLocation;
      console.log("Fetching events for coordinates:", { lat, lng, radius: RADIUS });
      const response = await fetch(`/api/events/nearby?lat=${lat}&lng=${lng}&radius=${RADIUS}`);
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      const data = await response.json();
      console.log("Received events:", data);
      return data;
    },
  });

  // Log when events update
  useEffect(() => {
    console.log("Events updated:", events.length, "events found");
    events.forEach(event => {
      console.log("Event marker data:", {
        id: event.id,
        title: event.title,
        position: [Number(event.latitude), Number(event.longitude)]
      });
    });
  }, [events]);

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
        
        {/* User location marker */}
        <Marker position={userLocation} icon={locationIcon}>
          <Popup>Your location</Popup>
        </Marker>

        {/* Event markers */}
        {events.map(event => {
          const lat = Number(event.latitude);
          const lng = Number(event.longitude);

          if (isNaN(lat) || isNaN(lng)) {
            console.warn("Invalid coordinates for event:", event);
            return null;
          }

          console.log("Rendering marker:", { id: event.id, title: event.title, position: [lat, lng] });

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
