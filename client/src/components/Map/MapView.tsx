import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";
import "leaflet/dist/leaflet.css";
import { format } from "date-fns";

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
        radius: "10", // 10km radius
      });

      const response = await fetch(`/api/events/nearby?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      const data = await response.json();
      console.log('Raw events data:', data);
      return data;
    }
  });

  // Filter future events
  const futureEvents = events?.filter(event => {
    const eventDate = new Date(event.startTime);
    return eventDate > new Date();
  });

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

        {/* Event markers - only showing future events */}
        {futureEvents?.map(event => {
          const lat = Number(event.latitude);
          const lng = Number(event.longitude);

          if (isNaN(lat) || isNaN(lng)) {
            console.error('Invalid coordinates for event:', event.title, lat, lng);
            return null;
          }

          return (
            <Marker
              key={event.id}
              position={[lat, lng]}
            >
              <Popup>
                <h3 className="font-bold">{event.title}</h3>
                <p>{event.description}</p>
                <p className="text-sm text-gray-600">
                  {format(new Date(event.startTime), "MMM d, yyyy 'at' h:mm a")}
                </p>
                {event.isPaid && (
                  <p className="text-sm font-semibold">
                    Price: €{Number(event.price).toFixed(2)}
                  </p>
                )}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}