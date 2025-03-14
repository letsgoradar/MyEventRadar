import { useState, useEffect } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin } from 'lucide-react';

export default function LocationMarker() {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const map = useMap();

  const locationIcon = L.divIcon({
    className: 'my-location-marker',
    html: `
      <div class="relative">
        <div class="absolute w-4 h-4 bg-blue-500 rounded-full opacity-40 animate-ping" 
             style="animation-duration: 1s;">
        </div>
        <div class="absolute w-4 h-4 bg-blue-500 rounded-full opacity-30 animate-ping" 
             style="animation-duration: 1.5s; animation-delay: 0.2s;">
        </div>
        <div class="relative w-4 h-4">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" 
               class="text-blue-500 transform -translate-x-1/2 -translate-y-1/2">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 24]
  });

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newPos: [number, number] = [
            position.coords.latitude,
            position.coords.longitude
          ];
          setPosition(newPos);
          map.flyTo(newPos, map.getZoom());
        },
        () => {
          console.error("Could not get user location");
          // Default to center of Noord-Brabant
          const defaultPos: [number, number] = [51.5719, 5.0722];
          setPosition(defaultPos);
          map.flyTo(defaultPos, map.getZoom());
        }
      );
    }
  }, [map]);

  return position === null ? null : (
    <Marker 
      position={position}
      icon={locationIcon}
    >
      <Popup>
        <div className="text-center">
          <p className="font-semibold">Mijn Locatie</p>
        </div>
      </Popup>
    </Marker>
  );
}