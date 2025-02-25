import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";
import L from "leaflet";

// Set default center to Oss
const DEFAULT_CENTER: [number, number] = [51.7656, 5.5314];
const DEFAULT_ZOOM = 13;

export default function MapView() {
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
      console.log('Fetched events:', data); // Debug log
      return data;
    },
  });

  // Debug log
  console.log('Events in render:', events);

  return (
    <div className="h-[calc(100vh-8rem)]">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        className="h-full w-full"
        style={{ position: 'relative', zIndex: 0 }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {events && events.map((event) => {
          const lat = Number(event.latitude);
          const lng = Number(event.longitude);
          console.log('Rendering marker for event:', event.title, 'at position:', lat, lng);

          return (
            <Marker
              key={event.id}
              position={[lat, lng]}
            >
              <Popup>
                <strong>{event.title}</strong>
                <p>{event.description}</p>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}