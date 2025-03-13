import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { Satellite } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import L from 'leaflet';
import React, { useState, useEffect } from 'react';
import type { Event } from "@shared/schema";
import './leaflet-fix.css';

// Get category color helper
const getCategoryColor = (category: string): string => {
  const colorMap: Record<string, string> = {
    festival: '#FF9800',
    food: '#4CAF50',
    culture: '#9C27B0',
    sports: '#2196F3',
    market: '#FF5722',
    education: '#607D8B',
    music: '#E91E63',
    technology: '#00BCD4',
    gaming: '#8BC34A',
    health: '#FFEB3B',
    nature: '#795548',
  };

  return colorMap[category.toLowerCase()] || '#9E9E9E';
};

const createEventIcon = (category: string) => {
  const color = getCategoryColor(category);
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });
};

interface MapViewProps {
  searchQuery: string;
  radius?: number;
  filteredEvents: Event[];
}

export default function MapView({ searchQuery, radius = 10, filteredEvents }: MapViewProps) {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isSatelliteView, setIsSatelliteView] = useState(false);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation: [number, number] = [
            position.coords.latitude,
            position.coords.longitude
          ];
          setUserLocation(newLocation);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setUserLocation([51.7656, 5.5314]);
        }
      );
    } else {
      setUserLocation([51.7656, 5.5314]);
    }
  }, []);

  const tileUrl = isSatelliteView
    ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  const tileConfig = isSatelliteView
    ? { subdomains: [] }
    : { subdomains: 'abcd' };

  if (!userLocation) {
    return <div>Loading map...</div>;
  }

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
        center={userLocation}
        zoom={13}
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer url={tileUrl} {...tileConfig} />

        {/* User location circle */}
        <Circle
          center={userLocation}
          radius={radius * 1000} // Convert km to meters
          pathOptions={{
            color: '#0097FB',
            fillColor: '#0097FB',
            fillOpacity: 0.1,
            weight: 1,
            pane: 'overlayPane' // Ensure it's in the overlay pane
          }}
        />

        {/* User location marker */}
        <Marker 
          position={userLocation}
          icon={L.divIcon({
            className: 'user-location-marker',
            html: `<div style="background-color: #0097FB; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
          })}
        >
          <Popup>Mijn locatie</Popup>
        </Marker>

        {/* Event markers */}
        {filteredEvents.map(event => {
          const lat = Number(event.latitude);
          const lng = Number(event.longitude);

          if (isNaN(lat) || isNaN(lng)) return null;

          return (
            <Marker
              key={event.id}
              position={[lat, lng]}
              icon={createEventIcon(event.category)}
            >
              <Popup className="event-popup" maxWidth={300}>
                <div className="text-sm pb-1">
                  <div className="font-semibold mb-1">{event.title}</div>
                  {event.description && (
                    <div className="mb-2 text-xs">
                      {event.description.substring(0, 80)}
                      {event.description.length > 80 ? '...' : ''}
                    </div>
                  )}
                  <Link
                    to={`/event/${event.id}`}
                    className="text-blue-600 hover:text-blue-800 underline text-xs"
                  >
                    Details bekijken
                  </Link>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}