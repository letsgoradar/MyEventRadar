import * as React from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import { Card } from "@/components/ui/card";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix voor Leaflet iconen in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

interface LocationPickerProps {
  defaultPosition?: [number, number];
  onChange?: (lat: number, lng: number) => void;
}

interface LocationMarkerProps {
  position: [number, number];
  setPosition: React.Dispatch<React.SetStateAction<[number, number]>>;
  onPositionChange: (position: [number, number]) => void;
}

// Component die interactie met de kaart afhandelt
function LocationMarker({ position, setPosition, onPositionChange }: LocationMarkerProps) {
  const map = useMapEvents({
    // Bij klikken op de kaart, verplaats de marker
    click(e) {
      const { lat, lng } = e.latlng;
      const newPosition: [number, number] = [lat, lng];
      setPosition(newPosition);
      if (onPositionChange) {
        onPositionChange(newPosition);
      }
    },
    // Bij laden van de kaart, centreer op de huidige positie
    locationfound(e) {
      const { lat, lng } = e.latlng;
      const newPosition: [number, number] = [lat, lng];
      setPosition(newPosition);
      if (onPositionChange) {
        onPositionChange(newPosition);
      }
      map.flyTo(newPosition, 15);
    },
  });

  // Toon marker op de huidige positie
  return position === null ? null : (
    <Marker 
      position={position}
      icon={L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: #ef4444; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.5);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      })}
    />
  );
}

export function LocationPicker({ defaultPosition = [51.7767, 5.5345], onChange }: LocationPickerProps) {
  const [position, setPosition] = React.useState<[number, number]>(defaultPosition);
  
  // Gebruik de browser geolocation API om de locatie van de gebruiker op te halen
  const locateUser = React.useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newPosition: [number, number] = [latitude, longitude];
          setPosition(newPosition);
          if (onChange) {
            const [lat, lng] = newPosition;
            onChange(lat, lng);
          }
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  }, [onChange]);
  
  // Locatie gebruiker ophalen bij eerste render
  React.useEffect(() => {
    locateUser();
  }, [locateUser]);
  
  // Bij wijziging van positie, roep onChange aan
  const handlePositionChange = React.useCallback((newPosition: [number, number]) => {
    if (onChange) {
      const [lat, lng] = newPosition;
      onChange(lat, lng);
    }
  }, [onChange]);
  
  return (
    <Card className="h-[300px] md:h-[400px] w-full overflow-hidden">
      <MapContainer
        center={position}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker 
          position={position} 
          setPosition={setPosition} 
          onPositionChange={handlePositionChange}
        />
      </MapContainer>
    </Card>
  );
}