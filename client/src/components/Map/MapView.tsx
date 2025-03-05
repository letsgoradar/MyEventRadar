import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import { Satellite } from 'lucide-react';
import { Button } from "@/components/ui/button";
import L from 'leaflet';
import React, { useState, useEffect } from 'react';
import type { Event } from "@shared/schema";
import './leaflet-fix.css';
import { useLocation } from "wouter";
import { EventDetailSheet } from "@/components/Events/EventDetailSheet";

// Default coordinates for Oss, Netherlands
const DEFAULT_LOCATION: [number, number] = [51.7656, 5.5314];

// Category colors for event markers
const categoryColors: Record<string, string> = {
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

// Helper to get category color
const getCategoryColor = (category: string): string => {
  return categoryColors[category.toLowerCase()] || '#9E9E9E';
};

// Create marker icon based on event category
const createEventIcon = (category: string) => {
  const color = getCategoryColor(category);
  return L.divIcon({
    className: 'custom-icon',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    html: `<div style="width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 2px rgba(0,0,0,0.2); background-color: ${color};"></div>`
  });
};

// User location marker component
function UserLocationMarker() {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const map = useMap();

  useEffect(() => {
    map.locate().on("locationfound", function (e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
      map.flyTo(e.latlng, map.getZoom());
    });
  }, [map]);

  if (!position) return null;

  return (
    <Marker position={position}>
      <Popup>
        <div className="text-sm font-medium">Mijn locatie</div>
      </Popup>
    </Marker>
  );
}

// Create event marker on double click
function CreateEventMarker() {
  const [, navigate] = useLocation();
  useMapEvents({
    dblclick: (e) => {
      navigate(`/create-event?lat=${e.latlng.lat}&lng=${e.latlng.lng}`);
    },
  });
  return null;
}

interface MapViewProps {
  filters: {
    searchQuery: string;
    category: string;
    fromDate: Date | null;
    toDate: Date | null;
    showPaidEvents: boolean;
    useDistanceFilter: boolean;
    distanceRadius: number;
  };
}

export default function MapView({ filters }: MapViewProps) {
  const [userLocation, setUserLocation] = useState<[number, number]>(DEFAULT_LOCATION);
  const [isSatelliteView, setIsSatelliteView] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [isEventDetailOpen, setIsEventDetailOpen] = useState(false);

  // Get user's location
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  }, []);

  // Fetch nearby events
  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ['/api/events/nearby'],
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: userLocation[0].toString(),
        lng: userLocation[1].toString(),
        radius: '25'
      });

      console.log('Fetching events with params:', params.toString());
      const response = await fetch(`/api/events/nearby?${params}`);

      if (!response.ok) {
        console.error('Failed to fetch events:', response.status);
        throw new Error('Failed to fetch events');
      }

      const data = await response.json();
      console.log('Received events:', data);
      return data;
    }
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        <p className="ml-3 text-muted-foreground">Evenementen laden...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-center">
        <div>
          <p className="text-red-500 mb-4">Er is een fout opgetreden bij het laden van evenementen.</p>
          <Button onClick={() => window.location.reload()}>Opnieuw proberen</Button>
        </div>
      </div>
    );
  }

  // Map tile configuration
  const tileUrl = isSatelliteView
    ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  const tileConfig = isSatelliteView ? { subdomains: [] } : { subdomains: 'abcd' };

  return (
    <div className="h-full relative">
      {/* Satellite toggle button */}
      <div className="absolute top-4 left-4 z-[1000]">
        <Button
          variant="outline"
          size="icon"
          className="bg-white/90 hover:bg-white"
          onClick={() => setIsSatelliteView(!isSatelliteView)}
        >
          <Satellite className={`h-4 w-4 ${isSatelliteView ? 'text-primary' : 'text-muted-foreground'}`} />
        </Button>
      </div>

      {/* Map */}
      <MapContainer
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
        <UserLocationMarker />

        {/* Event markers */}
        {Array.isArray(events) && events.map(event => {
          const lat = parseFloat(event.latitude);
          const lng = parseFloat(event.longitude);

          if (isNaN(lat) || isNaN(lng)) {
            console.warn('Invalid coordinates for event:', event);
            return null;
          }

          return (
            <Marker
              key={event.id}
              position={[lat, lng]}
              icon={createEventIcon(event.category)}
              eventHandlers={{
                click: () => {
                  setSelectedEventId(event.id);
                  setIsEventDetailOpen(true);
                },
              }}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold">{event.title}</div>
                  <div className="text-xs text-gray-600">{event.category}</div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Event detail sheet */}
      <EventDetailSheet
        eventId={selectedEventId}
        isOpen={isEventDetailOpen}
        onOpenChange={setIsEventDetailOpen}
        userLocation={{ lat: userLocation[0], lng: userLocation[1] }}
        onNavigateEvent={() => {}}
        hasNextEvent={false}
        hasPrevEvent={false}
        isInSearchResults={false}
      />
    </div>
  );
}