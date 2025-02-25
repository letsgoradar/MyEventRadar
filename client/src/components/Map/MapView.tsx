import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";
import * as L from 'leaflet';

// Fix Leaflet's default icon path
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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
      console.log('Fetched events:', data);
      return data;
    },
  });

  return (
    <div className="h-[calc(100vh-8rem)]">
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
          >
            <Popup>
              <h3 className="font-bold">{event.title}</h3>
              <p>{event.description}</p>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}