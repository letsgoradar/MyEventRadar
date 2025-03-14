import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { Satellite, MapPin } from 'lucide-react';
import { Button } from "@/components/ui/button";
import React, { useState, useEffect, useRef } from 'react';
import type { Event } from "@shared/schema";
import './leaflet-fix.css';
import EventMarker from "../Events/EventMarker";
import LocationMarker from "./LocationMarker";
import Legend from "./Legend";

const NEDERLAND_RADIUS = 300; // Maximale afstand voor heel Nederland in km
const LOCAL_RADIUS = 30; // Radius bij inzoomen op eigen locatie in km

// Helper function om radius te berekenen op basis van zoom level
function calculateRadiusFromZoom(zoom: number): number {
  const zoomToRadius = {
    0: NEDERLAND_RADIUS, 1: 3000, 2: 2000, 3: 1500,
    4: 1000, 5: 750, 6: 500, 7: 250,
    8: 100, 9: 75, 10: 50, 11: LOCAL_RADIUS,
    12: 10, 13: 5, 14: 2, 15: 1
  } as const;
  return zoomToRadius[Math.min(Math.max(zoom, 0), 15) as keyof typeof zoomToRadius] || NEDERLAND_RADIUS;
}

// Helper function om zoom level te berekenen op basis van radius
function calculateZoomFromRadius(radius: number): number {
  const radiusToZoom = {
    [NEDERLAND_RADIUS]: 7,
    3000: 1, 2000: 2, 1500: 3,
    1000: 4, 750: 5, 500: 6, 250: 7,
    100: 8, 75: 9, 50: 10, [LOCAL_RADIUS]: 11,
    10: 12, 5: 13, 2: 14, 1: 15
  };
  return radiusToZoom[radius as keyof typeof radiusToZoom] || 7;
}

// Map event handler component
function MapEventHandler({ onZoomEnd }: { onZoomEnd: (zoom: number) => void }) {
  const map = useMap();

  useEffect(() => {
    map.on('zoomend', () => {
      onZoomEnd(map.getZoom());
    });
  }, [map, onZoomEnd]);

  return null;
}

interface MapViewProps {
  searchQuery: string;
  radius?: number;
  filteredEvents: Event[];
  onEventClick?: (event: Event) => void;
  onRadiusChange?: (radius: number) => void;
}

export default function MapView({ 
  searchQuery, 
  radius = NEDERLAND_RADIUS,
  filteredEvents, 
  onEventClick,
  onRadiusChange 
}: MapViewProps) {
  const [isSatelliteView, setIsSatelliteView] = useState(false);
  const DEFAULT_CENTER: [number, number] = [51.5719, 5.0722]; // Center of Noord-Brabant
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const mapRef = useRef<L.Map | null>(null);

  // Update radius when zoom changes
  const handleZoomEnd = (zoom: number) => {
    const newRadius = calculateRadiusFromZoom(zoom);
    if (onRadiusChange) {
      onRadiusChange(newRadius);
    }
  };

  // Update zoom when radius changes
  useEffect(() => {
    if (mapRef.current && radius !== undefined) {
      const newZoom = calculateZoomFromRadius(radius);
      mapRef.current.setZoom(newZoom);
    }
  }, [radius]);

  const handleToggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleReturnToLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userPos: [number, number] = [
            position.coords.latitude,
            position.coords.longitude
          ];
          // Zoom niveau dat correspondeert met LOCAL_RADIUS (30km)
          const localZoom = calculateZoomFromRadius(LOCAL_RADIUS);
          mapRef.current?.flyTo(userPos, localZoom);
        },
        () => {
          console.error("Could not get user location");
        }
      );
    }
  };

  const filteredByCategory = selectedCategories.length > 0
    ? filteredEvents.filter(event => selectedCategories.includes(event.category))
    : filteredEvents;

  const tileUrl = isSatelliteView
    ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  return (
    <div className="h-full relative">
      {/* Map Controls */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
        <Button
          variant="outline"
          size="icon"
          className="bg-white/90 hover:bg-white h-8 w-8"
          onClick={() => setIsSatelliteView(!isSatelliteView)}
        >
          <Satellite className={`h-4 w-4 ${isSatelliteView ? 'text-primary' : 'text-muted-foreground'}`} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="bg-white/90 hover:bg-white h-8 w-8"
          onClick={handleReturnToLocation}
        >
          <MapPin className="h-4 w-4 text-blue-500" />
        </Button>
      </div>

      <MapContainer
        center={DEFAULT_CENTER}
        zoom={7} // Start met een zoom level dat heel Nederland laat zien
        className="h-full w-full"
        zoomControl={false}
        worldCopyJump={true}
        ref={mapRef}
      >
        <TileLayer 
          url={tileUrl}
          {...(isSatelliteView ? {} : { subdomains: 'abcd' })}
          maxZoom={19}
          detectRetina={true}
        />
        <LocationMarker />
        <MapEventHandler onZoomEnd={handleZoomEnd} />

        {/* Event Markers */}
        {filteredByCategory.map((event) => (
          <EventMarker
            key={event.id}
            event={event}
            onClick={() => onEventClick?.(event)}
          />
        ))}
      </MapContainer>

      {/* Legend */}
      <Legend 
        events={filteredEvents}
        selectedCategories={selectedCategories}
        onToggleCategory={handleToggleCategory}
      />
    </div>
  );
}