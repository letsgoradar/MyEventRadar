
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useQuery } from "@tanstack/react-query";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Event } from "@shared/schema";
import { useEffect } from 'react';

const DEFAULT_CENTER: [number, number] = [51.7656, 5.5314];
const RADIUS = 10;

// Create icon using a simpler approach
const eventIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export default function MapView() {
  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["events", "nearby", DEFAULT_CENTER],
    queryFn: async () => {
      const [lat, lng] = DEFAULT_CENTER;
      const response = await fetch(`/api/events/nearby?lat=${lat}&lng=${lng}&radius=${RADIUS}`);
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    },
  });

  // Debug logging
  useEffect(() => {
    console.log('Current events:', events);
    events.forEach(event => {
      console.log(`Event ${event.id}: [${event.latitude}, ${event.longitude}]`);
    });
  }, [events]);

  return (
    <div className="h-[calc(100vh-8rem)] w-full relative">
      {/* Debug info */}
      <div className="absolute top-0 right-0 z-[1000] bg-white p-2 text-xs">
        Events loaded: {events.length}
      </div>
      
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {events.map((event) => {
          const lat = Number(event.latitude);
          const lng = Number(event.longitude);
          
          if (isNaN(lat) || isNaN(lng)) {
            console.warn(`Invalid coordinates for event ${event.id}`);
            return null;
          }
          
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
      </MapContainer>
    </div>
  );
}
