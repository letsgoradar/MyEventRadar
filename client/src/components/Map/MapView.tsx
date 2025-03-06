import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { Satellite } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import L from 'leaflet';
import React, { useState, useEffect } from 'react';
import type { Event } from "@shared/schema";
import './leaflet-fix.css';
import { useLocation } from "wouter";

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

// Create event icon
const createEventIcon = (category: string) => {
  const color = getCategoryColor(category);
  return L.divIcon({
    className: 'custom-icon',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    html: `<div style="width: 12px; height: 12px; border-radius: 50%; border: 1px solid white; box-shadow: 0 1px 2px rgba(0,0,0,0.2); background-color: ${color};"></div>`
  });
};

function CreateEventMarker() {
  const [, navigate] = useLocation();
  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [startPoint, setStartPoint] = useState<{ x: number, y: number } | null>(null);
  const moveThreshold = 10;

  const map = useMapEvents({
    touchstart: (e) => {
      if (e.originalEvent.touches.length === 1) {
        const touch = e.originalEvent.touches[0];
        setStartPoint({ x: touch.clientX, y: touch.clientY });
        const pos = L.point(touch.clientX, touch.clientY);
        const touchLatLng = map.containerPointToLatLng(pos);
        setPressTimer(setTimeout(() => {
          navigate(`/create-event?lat=${touchLatLng.lat}&lng=${touchLatLng.lng}&zoom=18`);
        }, 512));
      }
    },
    touchmove: (e) => {
      if (startPoint && e.originalEvent.touches.length === 1) {
        const touch = e.originalEvent.touches[0];
        const deltaX = Math.abs(touch.clientX - startPoint.x);
        const deltaY = Math.abs(touch.clientY - startPoint.y);
        if (deltaX > moveThreshold || deltaY > moveThreshold) {
          if (pressTimer) {
            clearTimeout(pressTimer);
            setPressTimer(null);
          }
          setStartPoint(null);
        }
      }
    },
    touchend: () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        setPressTimer(null);
      }
      setStartPoint(null);
    },
    mousedown: (e) => {
      setStartPoint({ x: e.originalEvent.clientX, y: e.originalEvent.clientY });
      setPressTimer(setTimeout(() => {
        navigate(`/create-event?lat=${e.latlng.lat}&lng=${e.latlng.lng}&zoom=18`);
      }, 512));
    },
    mousemove: (e) => {
      if (startPoint) {
        const deltaX = Math.abs(e.originalEvent.clientX - startPoint.x);
        const deltaY = Math.abs(e.originalEvent.clientY - startPoint.y);
        if (deltaX > moveThreshold || deltaY > moveThreshold) {
          if (pressTimer) {
            clearTimeout(pressTimer);
            setPressTimer(null);
          }
          setStartPoint(null);
        }
      }
    },
    mouseup: () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        setPressTimer(null);
      }
      setStartPoint(null);
    }
  });

  return null;
}

interface MapViewProps {
  searchQuery: string;
}

export default function MapView({ searchQuery }: MapViewProps) {
  const [userLocation, setUserLocation] = useState<[number, number]>([51.7656, 5.5314]);
  const [isSatelliteView, setIsSatelliteView] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
          setLocation({lat: position.coords.latitude, lng: position.coords.longitude});
        }
      );
    }
  }, []);

  const { data: events = [] } = useQuery({
    queryKey: ["/api/events/nearby", userLocation],
    queryFn: async () => {
      if (!userLocation) return [];
      const params = new URLSearchParams({
        lat: userLocation[0].toString(),
        lng: userLocation[1].toString(),
        radius: "10",
      });

      const response = await fetch(`/api/events/nearby?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      return response.json();
    },
  });

  const filteredEvents = events.filter(event => {
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      return (
        event.title.toLowerCase().includes(searchLower) ||
        event.category.toLowerCase().includes(searchLower) ||
        (event.subcategory && event.subcategory.toLowerCase().includes(searchLower)) ||
        (event.description && event.description.toLowerCase().includes(searchLower))
      );
    }
    return true;
  });

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
        center={userLocation}
        zoom={13}
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer url={tileUrl} {...tileConfig} />
        <CreateEventMarker />

        {filteredEvents.map(event => {
          const lat = Number(event.latitude);
          const lng = Number(event.longitude);

          if (isNaN(lat) || isNaN(lng)) return null;

          const distance = location ?
            calculateDistance(location.lat, location.lng, lat, lng) :
            null;

          return (
            <Marker
              key={event.id}
              position={[lat, lng]}
              icon={createEventIcon(event.category)}
            >
              <Popup className="event-popup" maxWidth={300}>
                <div className="text-sm pb-1">
                  <div className="event-card-map">
                    <div className="font-semibold mb-1 flex items-center gap-1.5">
                      <div style={{ color: getCategoryColor(event.category) }}>
                        {event.category.charAt(0).toUpperCase() + event.category.slice(1)}
                      </div>
                      <div>{event.title}</div>
                    </div>
                    {event.description && (
                      <div className="mb-2 text-xs">
                        {event.description.substring(0, 80)}
                        {event.description.length > 80 ? '...' : ''}
                      </div>
                    )}
                    <div className="flex justify-between items-center text-xs text-gray-600 mb-1">
                      <span>{distance !== null ? `${distance.toFixed(1)} km` : ''}</span>
                    </div>
                    <Link
                      to={`/event/${event.id}`}
                      className="text-blue-600 hover:text-blue-800 underline text-xs"
                    >
                      Details bekijken
                    </Link>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

// Helper function to calculate distance
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    0.5 - Math.cos(dLat) / 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    (1 - Math.cos(dLon)) / 2;

  return R * 2 * Math.asin(Math.sqrt(a));
}