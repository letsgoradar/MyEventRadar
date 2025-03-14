import { MapContainer, TileLayer } from 'react-leaflet';
import { Satellite } from 'lucide-react';
import { Button } from "@/components/ui/button";
import React, { useState } from 'react';
import type { Event } from "@shared/schema";
import './leaflet-fix.css';
import EventMarker from "../Events/EventMarker";

interface MapViewProps {
  searchQuery: string;
  radius?: number;
  filteredEvents: Event[];
  onEventClick?: (event: Event) => void;
}

export default function MapView({ searchQuery, radius = 10, filteredEvents, onEventClick }: MapViewProps) {
  const [isSatelliteView, setIsSatelliteView] = useState(false);
  const DEFAULT_CENTER: [number, number] = [52.3676, 4.9041]; // Center of Netherlands

  const tileUrl = isSatelliteView
    ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  const tileConfig = isSatelliteView
    ? { subdomains: [] }
    : { subdomains: 'abcd' };

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
        zoom={7}
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer url={tileUrl} {...tileConfig} />

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