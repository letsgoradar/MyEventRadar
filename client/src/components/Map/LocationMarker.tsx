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
        <div class="absolute w-4 h-4 bg-blue-500 rounded-full opacity-40 animate-ping" 
             style="animation-duration: 1s;">
        </div>
        <div class="absolute w-4 h-4 bg-blue-500 rounded-full opacity-30 animate-ping" 
             style="animation-duration: 1.5s; animation-delay: 0.2s;">
        </div>
        <div class="relative w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg">
          <div class="absolute inset-0 bg-blue-500 rounded-full animate-pulse"></div>
        </div>
      </div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

  useEffect(() => {
    let isMounted = true;
    
    // Wacht even voordat we de locatie opvragen om er zeker van te zijn dat de map volledig is geïnitialiseerd
    const timer = setTimeout(() => {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            if (!isMounted) return;
            
            const newPos: [number, number] = [
              position.coords.latitude,
              position.coords.longitude
            ];
            setPosition(newPos);
            
            try {
              if (map) {
                // Veiligere manier om te controleren of de map is geladen
                // zonder gebruik te maken van interne _loaded property
                setTimeout(() => {
                  try {
                    map.flyTo(newPos, map.getZoom());
                  } catch (innerError) {
                    console.error("Delayed flyTo error:", innerError);
                  }
                }, 500);
              }
            } catch (error) {
              console.error("Map flyTo error:", error);
            }
          },
          () => {
            if (!isMounted) return;
            
            console.error("Could not get user location");
            // Default to center of Netherlands
            const defaultPos: [number, number] = [52.3676, 4.9041];
            setPosition(defaultPos);
            
            try {
              if (map) {
                // Veiligere manier om te controleren of de map is geladen
                setTimeout(() => {
                  try {
                    map.flyTo(defaultPos, map.getZoom());
                  } catch (innerError) {
                    console.error("Delayed flyTo error:", innerError);
                  }
                }, 500);
              }
            } catch (error) {
              console.error("Map flyTo error:", error);
            }
          }
        );
      }
    }, 1000);
    
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

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