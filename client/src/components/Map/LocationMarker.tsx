
import { useState, useEffect } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

export default function LocationMarker() {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const map = useMap();

  const locationIcon = L.divIcon({
    className: 'location-marker',
    html: `
      <div class="w-6 h-6 rounded-full bg-blue-500 border-2 border-white shadow-lg relative">
        <div class="absolute w-full h-full rounded-full animate-ping bg-blue-500 opacity-75"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  useEffect(() => {
    map.locate({
      watch: true,
      enableHighAccuracy: true
    });

    const onLocationFound = (e: L.LocationEvent) => {
      setPosition([e.latlng.lat, e.latlng.lng]);
      map.flyTo(e.latlng, map.getZoom());
    };

    const onLocationError = (e: L.ErrorEvent) => {
      console.error("Location error:", e.message);
      // Default to Oss center if location not found
      const defaultPos: [number, number] = [51.7656, 5.5314];
      setPosition(defaultPos);
      map.flyTo(defaultPos, map.getZoom());
    };

    map.on('locationfound', onLocationFound);
    map.on('locationerror', onLocationError);

    return () => {
      map.off('locationfound', onLocationFound);
      map.off('locationerror', onLocationError);
    };
  }, [map]);

  return position === null ? null : (
    <Marker 
      position={position}
      icon={locationIcon}
    >
      <Popup>
        <div className="text-center">
          <p className="font-semibold">Your Location</p>
          <p className="text-sm text-gray-600">{position[0].toFixed(4)}, {position[1].toFixed(4)}</p>
        </div>
      </Popup>
    </Marker>
  );
}
