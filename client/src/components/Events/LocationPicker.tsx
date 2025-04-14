import * as React from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, MapPin } from "lucide-react";
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
  onChange?: (position: [number, number]) => void;
}

interface LocationMarkerProps {
  position: [number, number];
  setPosition: React.Dispatch<React.SetStateAction<[number, number]>>;
  onPositionChange: (position: [number, number]) => void;
}

// Component om de marker te plaatsen en verplaatsen
function LocationMarker({ position, setPosition, onPositionChange }: LocationMarkerProps) {
  const map = useMapEvents({
    click(e) {
      const newPosition: [number, number] = [e.latlng.lat, e.latlng.lng];
      setPosition(newPosition);
      onPositionChange(newPosition);
    },
  });

  // Centreer de kaart op de marker wanneer position wijzigt
  React.useEffect(() => {
    map.flyTo(position, map.getZoom());
  }, [position, map]);

  return <Marker position={position} />;
}

export function LocationPicker({ defaultPosition = [51.7767, 5.5345], onChange }: LocationPickerProps) {
  const [position, setPosition] = React.useState<[number, number]>(defaultPosition);
  const [locationQuery, setLocationQuery] = React.useState("");
  
  // Handel marker positie wijzigingen af
  const handlePositionChange = (newPosition: [number, number]) => {
    if (onChange) {
      onChange(newPosition);
    }
  };

  // Zoek locatie op basis van query
  const searchLocation = async () => {
    if (!locationQuery) return;
    
    try {
      // Gebruik Nominatim API van OpenStreetMap voor geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationQuery)}`
      );
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        const newPosition: [number, number] = [
          parseFloat(data[0].lat),
          parseFloat(data[0].lon),
        ];
        
        setPosition(newPosition);
        handlePositionChange(newPosition);
      }
    } catch (error) {
      console.error("Error searching location:", error);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            placeholder="Zoek locatie..."
            value={locationQuery}
            onChange={(e) => setLocationQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                searchLocation();
              }
            }}
          />
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        </div>
        <Button onClick={searchLocation} type="button">Zoeken</Button>
      </div>
      
      <div className="h-[250px] relative rounded-md overflow-hidden border">
        <MapContainer
          center={position}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={false}
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
        
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-background/80 backdrop-blur-sm text-xs px-2 py-1 rounded-md text-center">
          <MapPin className="h-3 w-3 inline mr-1" />
          <span>Klik op de kaart om locatie te kiezen</span>
        </div>
      </div>
    </div>
  );
}

export default LocationPicker;