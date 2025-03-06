import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import {
  Satellite,
  X as CloseIcon,
  MapPin,
  Euro,
  Clock,
  Search
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import L from 'leaflet';
import React, { useState, useEffect, useRef } from 'react';
import type { Event } from "@shared/schema";
import './leaflet-fix.css';
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { nl } from "date-fns/locale";
import { Slider } from "@/components/ui/slider";
import { Calendar } from "@/components/ui/calendar";


// Add pulse animation CSS
const pulseAnimation = `
  @keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    70% { transform: scale(2); opacity: 0; }
    100% { transform: scale(1); opacity: 0; }
  }
`;

const style = document.createElement('style');
style.textContent = pulseAnimation;
document.head.appendChild(style);

const categoryColors = {
  'all': '#666666',  // gray for "all" category
  'festival': '#FF9800',
  'sports': '#2196F3',
  'food': '#4CAF50',
  'culture': '#9C27B0',
  'market': '#FF5722',
  'education': '#607D8B',
  'music': '#E91E63',
  'technology': '#00BCD4',
  'gaming': '#8BC34A',
  'health': '#FFEB3B',
  'nature': '#795548',
};

const getCategoryColor = (category: string): string => {
  const normalizedCategory = category.toLowerCase();
  return categoryColors[normalizedCategory as keyof typeof categoryColors] || '#9E9E9E';
};

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
  const [touchCount, setTouchCount] = useState(0);
  const [startPoint, setStartPoint] = useState<{ x: number, y: number } | null>(null);
  const moveThreshold = 10;

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

function MapBoundsControl() {
  const map = useMap();

  useEffect(() => {
    const storedBounds = sessionStorage.getItem('mapBounds');
    if (storedBounds) {
      const { events } = JSON.parse(storedBounds);
      if (events && events.length >= 2) {
        const bounds = L.latLngBounds(events.map(e => [e.lat, e.lng]));
        map.flyToBounds(bounds, {
          padding: [50, 50],
          duration: 1.5,
          easeLinearity: 0.5
        });
      }
    }
  }, [map, sessionStorage.getItem('mapBounds')]);

  return null;
}

function UserLocationMarker() {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const map = useMap();

  useEffect(() => {
    map.locate().on("locationfound", function (e) {
      setPosition([e.latitude, e.longitude]);
      map.flyTo([e.latitude, e.longitude], map.getZoom());
    });
  }, [map]);

  if (!position) return null;

  const pulsingIcon = L.divIcon({
    className: 'custom-icon',
    html: `
      <div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white pulse-animation"></div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

  return (
    <Marker position={position} icon={pulsingIcon}>
      <Popup>
        <div className="text-sm font-medium">Mijn locatie</div>
      </Popup>
    </Marker>
  );
}


export default function MapView({ filters, onFilterChange }: MapViewProps) {
  const [userLocation, setUserLocation] = useState<[number, number]>([51.7656, 5.5314]);
  const [isSatelliteView, setIsSatelliteView] = useState(false);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [mapKey, setMapKey] = useState(0);

  // Get active filters for display
  const activeFilters = [
    filters.searchQuery && { type: 'search', label: `Zoeken: "${filters.searchQuery}"` },
    filters.showFreeOnly && { type: 'price', label: 'Alleen gratis' },
    filters.maxPrice && { type: 'price', label: `Max €${filters.maxPrice}` },
    filters.maxDaysToEvent !== 14 && { 
      type: 'time', 
      label: filters.maxDaysToEvent === 999 ? 'Alle events' : `Binnen ${filters.maxDaysToEvent} dagen` 
    },
    filters.distanceRadius && { 
      type: 'distance', 
      label: `${filters.distanceRadius}km radius` 
    }
  ].filter(Boolean);

  // Fetch events
  const { data: events = [] } = useQuery({
    queryKey: ["/api/events/nearby", filters, userLocation],
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: userLocation[0].toString(),
        lng: userLocation[1].toString(),
        radius: filters.distanceRadius.toString(),
      });

      const response = await fetch(`/api/events/nearby?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      return response.json();
    },
  });

  // Filter events based on current filters
  const filteredEvents = events?.filter(event => {
    // Price filter
    if (filters.showFreeOnly && event.isPaid) return false;
    if (filters.maxPrice !== null && event.price > filters.maxPrice) return false;

    // Time filter
    const eventDate = new Date(event.startTime);
    const daysUntilEvent = differenceInDays(eventDate, new Date());
    if (daysUntilEvent < 0) return false; // Past events
    if (filters.maxDaysToEvent !== 999 && daysUntilEvent > filters.maxDaysToEvent) return false;

    // Search filter
    if (filters.searchQuery) {
      const searchLower = filters.searchQuery.toLowerCase();
      return (
        event.title.toLowerCase().includes(searchLower) ||
        event.description?.toLowerCase().includes(searchLower)
      );
    }

    return true;
  }) || [];

  // Update filter counts
  useEffect(() => {
    const totalEvents = filteredEvents.length;
    console.log('Total matching events:', totalEvents); // Debug log

    if (onFilterChange && typeof filters.totalMatchingEvents !== 'undefined') {
      onFilterChange({
        ...filters,
        totalMatchingEvents: totalEvents
      });
    }
  }, [filteredEvents, onFilterChange]);

  const getTimeToEvent = (startTime: string) => {
    const days = differenceInDays(new Date(startTime), new Date());
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days < 0) return "Past event";
    if (days < 7) return `In ${days} days`;
    if (days < 30) return `In ${Math.floor(days / 7)} weeks`;
    return `In ${Math.floor(days / 30)} months`;
  };


  const tileUrl = isSatelliteView
    ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  const tileConfig = isSatelliteView
    ? { subdomains: [] }
    : { subdomains: 'abcd' };

  const updateFilters = (updates: Partial<FilterProps>) => {
    if (onFilterChange) {
      onFilterChange({
        ...filters,
        ...updates
      });
    }
  };

  return (
    <div className="h-full relative">
      {/* Map Controls - Left side */}
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

      {/* Active Filters Display - Right side */}
      {activeFilters.length > 0 && (
        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-1.5 max-w-[200px]">
          {activeFilters.map((filter, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="bg-white/90 px-2 py-1 flex items-center justify-between gap-2 text-sm"
            >
              <span className="truncate">{filter.label}</span>
              <button
                className="opacity-70 hover:opacity-100"
                onClick={() => {
                  // Reset the specific filter
                  const updates: any = {};
                  switch (filter.type) {
                    case 'search':
                      updates.searchQuery = '';
                      break;
                    case 'price':
                      updates.showFreeOnly = false;
                      updates.maxPrice = null;
                      break;
                    case 'time':
                      updates.maxDaysToEvent = 14;
                      break;
                    case 'distance':
                      updates.distanceRadius = 5;
                      break;
                  }
                  onFilterChange({ ...filters, ...updates });
                }}
              >
                <CloseIcon className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Map Container */}
      <MapContainer
        key={mapKey}
        center={userLocation}
        zoom={13}
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer 
          url={tileUrl}
          {...tileConfig}
        />
        <CreateEventMarker />
        <MapBoundsControl />
        <UserLocationMarker />

        {/* Event Markers */}
        {filteredEvents.map(event => {
          const lat = Number(event.latitude);
          const lng = Number(event.longitude);

          if (isNaN(lat) || isNaN(lng)) return null;

          const distance = location ?
            calculateDistance(location.lat, location.lng, lat, lng) :
            null;

          const timeToEvent = getTimeToEvent(event.startTime);

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
                      <span>{timeToEvent}</span>
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

interface FilterProps {
  searchQuery: string;
  categories: string[];
  fromDate: Date | null;
  toDate: Date | null;
  showPaidEvents: boolean;
  maxPrice: number | null;
  useDistanceFilter: boolean;
  distanceRadius: number;
  showFreeOnly: boolean;
  maxDaysToEvent: number;
  totalMatchingEvents?: number; // Added for event count
  onFilterChange?: (filters: FilterProps) => void;
}

interface MapViewProps {
  filters: FilterProps;
  onFilterChange?: (filters: FilterProps) => void;
}