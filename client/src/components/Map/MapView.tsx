
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useQuery } from "@tanstack/react-query";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import type { Event } from "@shared/schema";

const DEFAULT_CENTER: [number, number] = [51.7656, 5.5314];
const RADIUS = 10;

function LocationMarker() {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const map = useMap();

  useEffect(() => {
    map.locate().on("locationfound", function (e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    });
  }, [map]);

  return position === null ? null : (
    <Marker 
      position={position}
      icon={L.divIcon({
        className: 'custom-icon',
        html: '<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white"></div>'
      })}
    >
      <Popup>You are here</Popup>
    </Marker>
  );
}

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

  const summerMusicFestival = events.find(event => event.title === "Summer Music Festival");
  const festivalPosition = summerMusicFestival ? 
    [Number(summerMusicFestival.latitude), Number(summerMusicFestival.longitude)] as [number, number] : 
    DEFAULT_CENTER;

  return (
    <div className="h-[calc(100vh-8rem)] w-full">
      <MapContainer
        center={festivalPosition}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <LocationMarker />
        
        {summerMusicFestival && (
          <Marker
            position={festivalPosition}
            icon={L.divIcon({
              className: 'custom-icon',
              html: '<div class="w-4 h-4 bg-orange-500 rounded-full border-2 border-gray-300"></div>'
            })}
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
