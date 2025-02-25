
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useQuery } from "@tanstack/react-query";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER: [number, number] = [51.7656, 5.5314];
const RADIUS = 10;

const eventIcon = L.divIcon({
  className: 'custom-icon',
  html: '<div class="w-4 h-4 bg-orange-500 rounded-full border-2 border-gray-300"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

function LocationMarker() {
  const map = useMap();

  useEffect(() => {
    map.locate().on("locationfound", function (e) {
      map.flyTo(e.latlng, map.getZoom());
    });
  }, [map]);

  return null;
}

export default function MapView() {
  const { data: events = [] } = useQuery({
    queryKey: ["events", "nearby", DEFAULT_CENTER],
    queryFn: async () => {
      const [lat, lng] = DEFAULT_CENTER;
      const response = await fetch(`/api/events/nearby?lat=${lat}&lng=${lng}&radius=${RADIUS}`);
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    },
  });

  return (
    <div className="h-[calc(100vh-8rem)] w-full relative">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={13}
        className="h-full w-full"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker />
        
        {events.map((event) => {
          const lat = Number(event.latitude);
          const lng = Number(event.longitude);
          
          if (isNaN(lat) || isNaN(lng)) return null;
          
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
