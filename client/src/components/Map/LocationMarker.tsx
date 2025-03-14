import { useState, useEffect } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

export default function LocationMarker() {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const map = useMap();

  const locationIcon = L.divIcon({
    className: 'my-location-marker',
    html: `
      <div class="relative">
        <div class="absolute w-6 h-6 bg-blue-500 rounded-full opacity-25 animate-ping"></div>
        <div class="relative w-6 h-6 bg-blue-500 rounded-full border-2 border-white">
          <div class="absolute inset-0 bg-blue-500 rounded-full animate-pulse"></div>
        </div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
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
          // Default to center of Netherlands
          const defaultPos: [number, number] = [52.3676, 4.9041];
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