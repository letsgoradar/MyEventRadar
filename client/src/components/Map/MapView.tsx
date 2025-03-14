import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { Satellite } from 'lucide-react';
import { Button } from "@/components/ui/button";
import React, { useState, useEffect } from 'react';
import type { Event } from "@shared/schema";
import './leaflet-fix.css';
import EventMarker from "../Events/EventMarker";
import LocationMarker from "./LocationMarker";

// Helper function om radius te berekenen op basis van zoom level
function calculateRadiusFromZoom(zoom: number): number {
  // Geschatte radius in km voor elk zoom level
  const zoomToRadius = {
    0: 5000, 1: 3000, 2: 2000, 3: 1500,
    4: 1000, 5: 750, 6: 500, 7: 250,
    8: 100, 9: 75, 10: 50, 11: 25,
    12: 10, 13: 5, 14: 2, 15: 1
  };
  return zoomToRadius[Math.min(Math.max(zoom, 0), 15)] || 25;
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
  radius = 25,
  filteredEvents, 
  onEventClick,
  onRadiusChange 
}: MapViewProps) {
  const [isSatelliteView, setIsSatelliteView] = useState(false);
  const DEFAULT_CENTER: [number, number] = [52.3676, 4.9041]; // Center of Netherlands

  const handleZoomEnd = (zoom: number) => {
    const newRadius = calculateRadiusFromZoom(zoom);
    onRadiusChange?.(newRadius);
  };

  const tileUrl = isSatelliteView
    ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

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
      </div>

      <MapContainer
        center={DEFAULT_CENTER}
        zoom={8} // Start met een zoom level dat ongeveer 25km radius geeft
        className="h-full w-full"
        zoomControl={false}
        worldCopyJump={true}
      >
        <TileLayer 
          url={tileUrl}
          {...(isSatelliteView ? {} : { subdomains: 'abc' })}
          maxZoom={19}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <LocationMarker />
        <MapEventHandler onZoomEnd={handleZoomEnd} />

        {/* Event Markers */}
        {filteredEvents.map((event) => (
          <EventMarker
            key={event.id}
            event={event}
            onClick={() => onEventClick?.(event)}
          />
        ))}
      </MapContainer>
    </div>
  );
}