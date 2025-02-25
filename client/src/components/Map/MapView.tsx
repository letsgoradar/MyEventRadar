import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useQuery } from "@tanstack/react-query";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React, { useState, useEffect } from 'react';
import type { Event } from "@shared/schema";
import './leaflet-fix.css';

// Define the filter props interface
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

// Category colors mapping
const categoryColors: { [key: string]: string } = {
  'festival': '#FF6B6B',   // Coral Red
  'sport': '#4ECDC4',      // Turquoise
  'music': '#45B7D1',      // Sky Blue
  'food': '#96CEB4',       // Sage Green
  'culture': '#9B59B6',    // Purple
  'education': '#3498DB',  // Blue
  'networking': '#F1C40F', // Yellow
  'other': '#95A5A6',      // Gray
};

// Function to get color for category
const getCategoryColor = (category: string): string => {
  return categoryColors[category.toLowerCase()] || categoryColors.other;
};

// Custom icon creator function
const createEventIcon = (category: string) => {
  const color = getCategoryColor(category);
  return L.divIcon({
    className: 'custom-icon',
    html: `<div class="w-4 h-4 rounded-full border-2 border-white" style="background-color: ${color};"></div>`
  });
};

// Legend Component
const MapLegend = () => {
  return (
    <div className="absolute bottom-4 right-4 bg-white p-2 rounded-lg shadow-md z-[1000]">
      <h4 className="text-sm font-bold mb-2">Event Categories</h4>
      <div className="grid gap-1">
        {Object.entries(categoryColors).map(([category, color]) => (
          <div key={category} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs capitalize">{category}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// User location marker
function LocationMarker() {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const map = useMap();

  useEffect(() => {
    map.locate().on("locationfound", function (e) {
      const newPos: [number, number] = [e.latlng.lat, e.latlng.lng];
      setPosition(newPos);
      map.flyTo(e.latlng, map.getZoom());
    });
  }, [map]);

  return position === null ? null : (
    <Marker 
      position={position}
      icon={L.divIcon({
        className: 'custom-icon',
        html: '<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white pulse-animation"></div>'
      })}
    >
      <Popup>You are here</Popup>
    </Marker>
  );
}

export default function MapView({ filters }: MapViewProps) {
  const [userLocation, setUserLocation] = useState<[number, number]>([51.7656, 5.5314]); // Default to Oss

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

  // Log all events for debugging
  console.log('Processing events:', events.map(e => ({
    id: e.id,
    title: e.title,
    category: e.category,
    coords: [e.latitude, e.longitude]
  })));

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
    if (filters.category && event.category !== filters.category) return false;
    if (filters.showPaidEvents && !event.isPaid) return false;
    if (filters.searchQuery && !event.title.toLowerCase().includes(filters.searchQuery.toLowerCase())) return false;

    return true;
  });

  console.log('Filtered events:', filteredEvents.length);

  return (
    <div className="h-[calc(100vh-8rem)] relative">
      <MapContainer
        center={userLocation}
        zoom={13}
        className="h-full w-full"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <LocationMarker />
        <MapLegend />

        {filteredEvents.map(event => {
          const lat = Number(event.latitude);
          const lng = Number(event.longitude);

          console.log('Adding marker for event:', {
            id: event.id,
            title: event.title,
            category: event.category,
            position: [lat, lng]
          });

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