import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { Satellite, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from "@/components/ui/button";
import React, { useState, useEffect, useRef } from 'react';
import type { Event } from "@shared/schema";
import './leaflet-fix.css';
import L from 'leaflet';
import EventMarker from "../Events/EventMarker";
import LocationMarker from "./LocationMarker";

// Helper function om radius te berekenen op basis van zoom level
function calculateRadiusFromZoom(zoom: number): number {
  // Geschatte radius in km voor elk zoom level
  const zoomToRadius: Record<number, number> = {
    0: 5000, 1: 3000, 2: 2000, 3: 1500,
    4: 1000, 5: 750, 6: 500, 7: 250,
    8: 100, 9: 75, 10: 50, 11: 25,
    12: 10, 13: 5, 14: 2, 15: 1
  };
  return zoomToRadius[Math.min(Math.max(zoom, 0), 15)] || 25;
}

// Map event handler component
function MapEventHandler({ 
  onZoomEnd, 
  highlightedEventId = null,
  events = []
}: { 
  onZoomEnd: (zoom: number) => void;
  highlightedEventId?: number | null;
  events?: Event[];
}) {
  const map = useMap();
  const prevHighlightRef = useRef<number | null>(null);

  useEffect(() => {
    map.on('zoomend', () => {
      onZoomEnd(map.getZoom());
    });
  }, [map, onZoomEnd]);

  // Handle highlighting events
  useEffect(() => {
    if (highlightedEventId && highlightedEventId !== prevHighlightRef.current) {
      // Find event with this ID
      const event = events.find(e => e.id === highlightedEventId);
      if (event && event.latitude && event.longitude) {
        map.setView([Number(event.latitude), Number(event.longitude)], 14, {
          animate: true,
          duration: 0.5
        });
      }
      prevHighlightRef.current = highlightedEventId;
    }
  }, [highlightedEventId, events, map]);

  return null;
}

interface MapViewProps {
  searchQuery: string;
  radius?: number;
  filteredEvents: Event[];
  onEventClick?: (event: Event) => void;
  onRadiusChange?: (radius: number) => void;
  highlightedEventId?: number | null;
}

export default function MapView({ 
  searchQuery, 
  radius = 25,
  filteredEvents, 
  onEventClick,
  onRadiusChange,
  highlightedEventId
}: MapViewProps) {
  const [isSatelliteView, setIsSatelliteView] = useState(false);
  const DEFAULT_CENTER: [number, number] = [52.3676, 4.9041]; // Center of Netherlands
  const [zoomLevel, setZoomLevel] = useState(9);
  const mapRef = useRef<L.Map | null>(null);

  const handleZoomEnd = (zoom: number) => {
    setZoomLevel(zoom);
    const newRadius = calculateRadiusFromZoom(zoom);
    onRadiusChange?.(newRadius);
  };

  // Custom map control component to access map instance
  const MapControls = () => {
    const map = useMap();
    
    // Store the map instance in ref
    useEffect(() => {
      if (map) {
        mapRef.current = map;
      }
    }, [map]);
    
    return null;
  };

  const handleZoomIn = () => {
    if (mapRef.current) {
      mapRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current) {
      mapRef.current.zoomOut();
    }
  };

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
          onClick={handleZoomIn}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="bg-white/90 hover:bg-white h-8 w-8"
          onClick={handleZoomOut}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
      </div>

      <MapContainer
        center={DEFAULT_CENTER}
        zoom={zoomLevel} // Start met een zoom level dat ongeveer 25km radius geeft
        className="h-full w-full"
        zoomControl={false}
        worldCopyJump={true}
      >
        <TileLayer 
          url={tileUrl}
          {...(isSatelliteView ? {} : { subdomains: 'abcd' })}
          maxZoom={19}
          detectRetina={true}
        />
        <LocationMarker />
        <MapControls />
        <MapEventHandler 
          onZoomEnd={handleZoomEnd} 
          highlightedEventId={highlightedEventId}
          events={filteredEvents}
        />

        {/* Event Markers */}
        {filteredEvents.map((event) => (
          <EventMarker
            key={event.id}
            event={event}
            onClick={() => onEventClick?.(event)}
            isHighlighted={event.id === highlightedEventId}
          />
        ))}
      </MapContainer>
    </div>
  );
}