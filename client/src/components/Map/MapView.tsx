import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";
import "leaflet/dist/leaflet.css";
import L from 'leaflet';
import { format } from "date-fns";

// Fix Leaflet default icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom icon for user location
const userIcon = L.icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="8" fill="#3b82f6" stroke="white" stroke-width="2"/>
    </svg>
  `),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

interface FilterProps {
  searchQuery: string;
  category: string;
  fromDate: Date;
  toDate: Date;
  showFreeEvents: boolean;
  useDistanceFilter: boolean;
  distanceRadius: number;
}

interface MapViewProps {
  filters: FilterProps;
  filtersEnabled: boolean;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default function MapView({ filters, filtersEnabled }: MapViewProps) {
  // Default to Oss center
  const [userLocation, setUserLocation] = useState<[number, number]>([51.7656, 5.5314]);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation: [number, number] = [position.coords.latitude, position.coords.longitude];
          console.log('User location set to:', newLocation);
          setUserLocation(newLocation);
          setMapReady(true);
        },
        (error) => {
          console.error("Location error:", error);
          // Keep default Oss center
          setMapReady(true);
        }
      );
    } else {
      setMapReady(true);
    }
  }, []);

  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events/nearby", filters, filtersEnabled],
    queryFn: async () => {
      console.log('Fetching events with params:', {
        location: userLocation,
        radius: filters.useDistanceFilter ? filters.distanceRadius : 10
      });

      const params = new URLSearchParams({
        lat: userLocation[0].toString(),
        lng: userLocation[1].toString(),
        radius: filters.useDistanceFilter ? filters.distanceRadius.toString() : "10",
      });

      const response = await fetch(`/api/events/nearby?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      const data = await response.json();
      console.log('Received events from API:', data);
      return data;
    },
    enabled: mapReady,
  });

  const filteredEvents = events?.filter(event => {
    // Skip invalid coordinates
    if (!event.latitude || !event.longitude) {
      console.log('Event skipped - invalid coordinates:', event.title);
      return false;
    }

    const eventDate = new Date(event.startTime);
    const now = new Date();

    // Skip past events
    if (eventDate <= now) {
      return false;
    }

    if (!filtersEnabled) {
      return true;
    }

    // Apply filters only when enabled
    if (filters.searchQuery && !event.title.toLowerCase().includes(filters.searchQuery.toLowerCase())) {
      return false;
    }

    if (filters.category && event.category !== filters.category) {
      return false;
    }

    if (eventDate < filters.fromDate || eventDate > filters.toDate) {
      return false;
    }

    if (filters.showFreeEvents && event.isPaid) {
      return false;
    }

    if (filters.useDistanceFilter) {
      const distance = calculateDistance(
        userLocation[0],
        userLocation[1],
        Number(event.latitude),
        Number(event.longitude)
      );
      if (distance > filters.distanceRadius) {
        return false;
      }
    }

    return true;
  });

  if (isLoading) return <div>Loading map...</div>;

  return (
    <div className="h-[calc(100vh-8rem)]">
      <MapContainer
        center={userLocation}
        zoom={13}
        className="h-full w-full"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {/* User location marker */}
        <Marker position={userLocation} icon={userIcon}>
          <Popup>
            <div className="text-center">
              <strong>Jouw locatie</strong>
            </div>
          </Popup>
        </Marker>

        {/* Event markers */}
        {filteredEvents?.map(event => {
          const latitude = Number(event.latitude);
          const longitude = Number(event.longitude);

          if (isNaN(latitude) || isNaN(longitude)) {
            console.error('Invalid coordinates for event:', event.title);
            return null;
          }

          return (
            <Marker
              key={event.id}
              position={[latitude, longitude]}
            >
              <Popup>
                <div className="min-w-[200px]">
                  <h3 className="font-bold text-lg">{event.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                  <p className="text-sm mt-2">
                    {format(new Date(event.startTime), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                  {event.isPaid && event.price && (
                    <p className="text-sm font-semibold mt-1">
                      Prijs: €{Number(event.price).toFixed(2)}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}