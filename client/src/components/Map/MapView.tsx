import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useQuery } from "@tanstack/react-query";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Event } from "@shared/schema";

const DEFAULT_CENTER: [number, number] = [51.7656, 5.5314];
const RADIUS = 10;

// Fix Leaflet default marker path issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
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

  // Filter events to only include "Summer Music Festival"
  const summerMusicFestival = events.find(event => event.title === "Summer Music Festival");

  let center = DEFAULT_CENTER;
  let zoom = 13;

  if (summerMusicFestival) {
    const lat = Number(summerMusicFestival.latitude);
    const lng = Number(summerMusicFestival.longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
        center = [lat, lng];
        zoom = 15; // Zoom in closer to the festival
    }
  }


  return (
    <div className="h-[calc(100vh-8rem)] w-full">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {summerMusicFestival && (
          <Marker
            key={summerMusicFestival.id}
            position={[Number(summerMusicFestival.latitude), Number(summerMusicFestival.longitude)]}
          >
            <Popup>
              <div className="text-sm">
                <h3 className="font-bold">{summerMusicFestival.title}</h3>
                <p>{summerMusicFestival.description}</p>
                {summerMusicFestival.isPaid && <p>Price: €{summerMusicFestival.price}</p>}
                <p>Category: {summerMusicFestival.category}</p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}