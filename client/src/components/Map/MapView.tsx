import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useQuery } from "@tanstack/react-query";
import L from 'leaflet';
import "leaflet/dist/leaflet.css";
import LocationMarker from './LocationMarker';
import type { Event } from "@shared/schema";
import { DialogDescription } from "@/components/ui/dialog";

const DEFAULT_CENTER: [number, number] = [51.7656, 5.5314];
const RADIUS = 10;

const blueIcon = L.divIcon({
  className: 'custom-icon',
  html: '<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white"></div>'
});

function MapView() {
  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["events", "nearby", DEFAULT_CENTER],
    queryFn: async () => {
      const [lat, lng] = DEFAULT_CENTER;
      const response = await fetch(`/api/events/nearby?lat=${lat}&lng=${lng}&radius=${RADIUS}`);
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    },
  });

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={13}
      className="h-full w-full"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <LocationMarker />
      {events.map((event) => (
        <Marker
          key={event.id}
          position={[Number(event.latitude), Number(event.longitude)]}
          icon={blueIcon}
        >
          <Popup>
            <DialogDescription>Event details</DialogDescription>
            <div className="text-sm">
              <h3 className="font-bold">{event.title}</h3>
              <p>{event.description}</p>
              {event.isPaid && <p>Price: €{event.price}</p>}
              <p>Category: {event.category}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

export default MapView;