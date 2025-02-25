import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";
import "leaflet/dist/leaflet.css";

// Fix default icon issue
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png')
});

// Center of Oss
const DEFAULT_CENTER: [number, number] = [51.7656, 5.5314];

export default function MapView() {
  const { data: events, isLoading, error } = useQuery<Event[]>({
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
      console.log('Fetched events:', data);
      return data;
    }
  });

  useEffect(() => {
    if (events) {
      console.log('Events loaded:', events.length);
      events.forEach(event => {
        console.log('Event location:', event.title, event.latitude, event.longitude);
      });
    }
  }, [events]);

  if (isLoading) return <div>Loading map...</div>;
  if (error) return <div>Error loading map</div>;

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

        {events && events.map(event => {
          const lat = Number(event.latitude);
          const lng = Number(event.longitude);
          console.log('Rendering marker:', event.title, lat, lng);

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