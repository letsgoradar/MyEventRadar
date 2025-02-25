import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Satellite } from 'lucide-react';
import { Button } from "@/components/ui/button";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React, { useState, useEffect } from 'react';
import type { Event } from "@shared/schema";
import './leaflet-fix.css';

// Category colors mapping - Updated to new color scheme
const categoryColors: { [key: string]: string } = {
  'festival': '#FF6B00',   // Gaspedaal Orange
  'sport': '#0066FF',      // Gaspedaal Blue
  'music': '#4285F4',      // Google Blue
  'food': '#FBBC05',       // Google Yellow
  'culture': '#7B1FA2',    // Purple
  'other': '#757575',      // Gray
};

// Function to get color for category
const getCategoryColor = (category: string): string => {
  return categoryColors[category.toLowerCase()] || categoryColors.other;
};

// Function to create event icon
const createEventIcon = (category: string) => {
  const color = getCategoryColor(category);
  return L.divIcon({
    className: 'custom-icon',
    html: `<div class="w-4 h-4 rounded-full border-2 border-white shadow-lg" style="background-color: ${color};"></div>`
  });
};

// Function to create location arrow with direction
const createCompassNeedleIcon = (heading: number = 0) => {
  const svg = `
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(${heading} 16 16)">
        <path d="M16 4L20 14L16 28L12 14L16 4Z" fill="#4285F4"/>
        <path d="M16 4L20 14L16 12L12 14L16 4Z" fill="#5C9FFF"/>
        <circle cx="16" cy="14" r="2" fill="white"/>
      </g>
    </svg>
  `;

  return L.divIcon({
    className: 'user-location-marker',
    html: `<div class="pulse-animation">${svg}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

// User location marker with compass direction
function LocationMarker() {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const map = useMap();

  useEffect(() => {
    if ('geolocation' in navigator) {
      // Watch position for real-time updates
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const newPos: [number, number] = [pos.coords.latitude, pos.coords.longitude];

          // Update heading if available
          if (pos.coords.heading !== null) {
            setHeading(pos.coords.heading);
          }

          setPosition(newPos);
          map.flyTo(newPos, map.getZoom());
        },
        undefined,
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 5000
        }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [map]);

  // Also listen for device orientation changes
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.webkitCompassHeading) {
        // iOS devices
        setHeading(e.webkitCompassHeading);
      } else if (e.alpha !== null) {
        // Other devices
        setHeading(360 - e.alpha);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => window.removeEventListener('deviceorientation', handleOrientation, true);
  }, []);

  return position === null ? null : (
    <Marker
      position={position}
      icon={createCompassNeedleIcon(heading)}
    >
      <Popup>
        <div className="text-center">
          <div className="font-bold">You are here</div>
          <div className="text-sm text-gray-600">
            {position[0].toFixed(4)}, {position[1].toFixed(4)}
          </div>
          <div className="text-sm text-blue-600">
            Heading: {Math.round(heading)}°
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

// Interactive Legend Component
const MapLegend = ({ onToggleCategory, activeCategories }: {
  onToggleCategory: (category: string) => void;
  activeCategories: Set<string>;
}) => {
  return (
    <div className="absolute bottom-4 right-4 bg-white p-3 rounded-lg shadow-md z-[1000]">
      <h4 className="text-sm font-bold mb-2">Filter by Category</h4>
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

export default function MapView({ filters }: MapViewProps) {
  const [userLocation, setUserLocation] = useState<[number, number]>([51.7656, 5.5314]); // Default to Oss
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    new Set(Object.keys(categoryColors))
  );
  const [isSatelliteView, setIsSatelliteView] = useState(false);

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

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
          console.log('User location set:', [position.coords.latitude, position.coords.longitude]);
        },
        () => {
          console.log('Using default location (Oss):', userLocation);
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

      console.log('Fetching events with params:', Object.fromEntries(params));
      const response = await fetch(`/api/events/nearby?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }

      const data = await response.json();
      console.log('Received events:', data);
      return data;
    },
  });

  // Filter events based on criteria
  const filteredEvents = events.filter(event => {
    const lat = Number(event.latitude);
    const lng = Number(event.longitude);

    // Basic coordinate validation
    if (isNaN(lat) || isNaN(lng)) {
      console.warn('Invalid coordinates for event:', {
        id: event.id,
        title: event.title,
        latitude: event.latitude,
        longitude: event.longitude
      });
      return false;
    }

    // Apply filters
    if (!activeCategories.has(event.category.toLowerCase())) return false;
    if (filters.category && event.category !== filters.category) return false;
    if (filters.showPaidEvents && !event.isPaid) return false;
    if (filters.searchQuery && !event.title.toLowerCase().includes(filters.searchQuery.toLowerCase())) return false;

    return true;
  });

  console.log('Filtered events:', filteredEvents.length);

  // Map tile styles
  const tileUrl = isSatelliteView
    ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  const tileConfig = isSatelliteView
    ? { subdomains: [] }
    : { subdomains: 'abcd' };

  return (
    <div className="h-[calc(100vh-8rem)] relative">
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
        className="h-full w-full leaflet-grid-hide"
        attributionControl={false}
      >
        <TileLayer
          url={tileUrl}
          attribution={false}
          {...tileConfig}
        />
        <LocationMarker />
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