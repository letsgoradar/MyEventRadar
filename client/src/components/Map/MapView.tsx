import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { Satellite } from 'lucide-react';
import { Button } from "@/components/ui/button";
import L from 'leaflet';
import React, { useState, useEffect } from 'react';
import type { Event } from "@shared/schema";
import './leaflet-fix.css';
import { useLocation } from "wouter";

const categoryColors = {
  'festival': '#FF6B00',
  'sport': '#0066FF',
  'music': '#4285F4',
  'food': '#FBBC05',
  'culture': '#7B1FA2',
  'other': '#757575',
};

const getCategoryColor = (category: string): string => {
  return categoryColors[category.toLowerCase()] || categoryColors.other;
};

const createEventIcon = (category: string) => {
  const color = getCategoryColor(category);
  return L.divIcon({
    className: 'custom-icon',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    html: `<div style="width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2); background-color: ${color};"></div>`
  });
};

const MapLegend = ({ onToggleCategory, activeCategories }: {
  onToggleCategory: (category: string) => void;
  activeCategories: Set<string>;
}) => {
  return (
    <div className="absolute bottom-16 right-4 bg-white p-3 rounded-lg shadow-md z-[1000]">
      <div className="grid gap-2">
        {Object.entries(categoryColors).map(([category, color]) => {
          const isActive = activeCategories.has(category);
          return (
            <button
              key={category}
              onClick={() => onToggleCategory(category)}
              className={`flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 transition-colors
                ${isActive ? 'opacity-100' : 'opacity-50'}`}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs capitalize">{category}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

function CreateEventMarker() {
  const [, navigate] = useLocation();
  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [touchCount, setTouchCount] = useState(0);
  const [startPoint, setStartPoint] = useState<{ x: number, y: number } | null>(null);
  const moveThreshold = 10; // pixels

  const map = useMapEvents({
    touchstart: (e) => {
      const touches = e.originalEvent.touches;
      setTouchCount(touches.length);

      if (touches.length === 1) {
        const touch = touches[0];
        setStartPoint({ x: touch.clientX, y: touch.clientY });

        const container = map.getContainer();
        const pos = L.point(touch.clientX, touch.clientY);
        const touchLatLng = map.containerPointToLatLng(pos);

        setPressTimer(setTimeout(() => {
          navigate(`/create?lat=${touchLatLng.lat}&lng=${touchLatLng.lng}&zoom=18`);
        }, 1000));
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
      setTouchCount(0);
      setStartPoint(null);
    },
    touchcancel: () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        setPressTimer(null);
      }
      setTouchCount(0);
      setStartPoint(null);
    },
    mousedown: (e) => {
      setStartPoint({ x: e.originalEvent.clientX, y: e.originalEvent.clientY });
      setPressTimer(setTimeout(() => {
        navigate(`/create?lat=${e.latlng.lat}&lng=${e.latlng.lng}&zoom=18`);
      }, 1000));
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
    },
    mouseleave: () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        setPressTimer(null);
      }
      setStartPoint(null);
    }
  });

  return null;
}

export default function MapView({ filters }: MapViewProps) {
  const [userLocation, setUserLocation] = useState<[number, number]>([51.7656, 5.5314]); // Default to Oss
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    new Set(Object.keys(categoryColors))
  );
  const [isSatelliteView, setIsSatelliteView] = useState(false);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        }
      );
    }
  }, []);

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events/nearby", filters, userLocation],
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: userLocation[0].toString(),
        lng: userLocation[1].toString(),
        radius: filters.useDistanceFilter ? filters.distanceRadius.toString() : "10"
      });

      const response = await fetch(`/api/events/nearby?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      return response.json();
    },
  });

  const filteredEvents = events.filter(event => {
    if (!activeCategories.has(event.category.toLowerCase())) return false;
    if (filters.category && event.category !== filters.category) return false;
    if (filters.showPaidEvents && !event.isPaid) return false;
    if (filters.searchQuery && !event.title.toLowerCase().includes(filters.searchQuery.toLowerCase())) return false;
    return true;
  });

  const toggleCategory = (category: string) => {
    setActiveCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const tileUrl = isSatelliteView
    ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  const tileConfig = isSatelliteView
    ? { subdomains: [] }
    : { subdomains: 'abcd' };

  return (
    <div className="h-full relative">
      <Button
        variant="outline"
        size="icon"
        className="absolute top-4 right-4 z-[1000] bg-white/90 hover:bg-white"
        onClick={() => setIsSatelliteView(!isSatelliteView)}
        title={isSatelliteView ? "Switch to Map View" : "Switch to Satellite View"}
      >
        <Satellite className={`h-4 w-4 ${isSatelliteView ? 'text-primary' : 'text-muted-foreground'}`} />
      </Button>

      <MapContainer
        center={userLocation}
        zoom={13}
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer url={tileUrl} {...tileConfig} />
        <CreateEventMarker />
        <MapLegend
          onToggleCategory={toggleCategory}
          activeCategories={activeCategories}
        />

        {filteredEvents.map(event => {
          const lat = Number(event.latitude);
          const lng = Number(event.longitude);

          return (
            <Marker
              key={event.id}
              position={[lat, lng]}
              icon={createEventIcon(event.category)}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-bold">{event.title}</h3>
                  <p className="text-sm">{event.description}</p>
                  <p className="text-sm mt-1">
                    Category: <span className="capitalize">{event.category}</span>
                  </p>
                  {event.isPaid && <p className="text-sm mt-1">Price: €{event.price}</p>}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

interface FilterProps {
  searchQuery: string;
  category: string;
  fromDate: Date | null;
  toDate: Date | null;
  showPaidEvents: boolean;
  useDistanceFilter: boolean;
  distanceRadius: number;
}

interface MapViewProps {
  filters: FilterProps;
}