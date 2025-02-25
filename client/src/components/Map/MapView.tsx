import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";

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
      <div className="absolute inset-0">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          className="h-full w-full"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {events?.map((event) => (
            <Marker
              key={event.id}
              position={[Number(event.latitude), Number(event.longitude)]}
            />
          ))}
        </MapContainer>
      </div>
    </div>
  );
}