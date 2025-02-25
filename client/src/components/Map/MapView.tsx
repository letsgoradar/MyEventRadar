import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";
import "leaflet/dist/leaflet.css";
import { format } from "date-fns";

interface FilterProps {
  searchQuery: string;
  category: string;
  fromDate: Date;
  toDate: Date;
  showPaidEvents: boolean;
  useDistanceFilter: boolean;
  distanceRadius: number;
}

interface MapViewProps {
  filters: FilterProps;
}

// Calculate distance between two points using Haversine formula
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

export default function MapView({ filters }: MapViewProps) {
  // Default center (Oss)
  const DEFAULT_CENTER: [number, number] = [51.7656, 5.5314];
  const [userLocation, setUserLocation] = useState<[number, number]>(DEFAULT_CENTER);

  // Get user location
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.error("Location error:", error);
        }
      );
    }
  }, []);

  // Fetch events
  const { data: events } = useQuery<Event[]>({
    queryKey: ["/api/events/nearby", filters],
    queryFn: async () => {
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
      console.log('Fetched events:', data);
      return data;
    },
  });

  // Filter and process events
  const filteredEvents = events?.filter(event => {
    const eventDate = new Date(event.startTime);
    const now = new Date();

    // Basic date filter - only future events
    if (eventDate <= now) return false;

    // Apply search filter
    if (filters.searchQuery && !event.title.toLowerCase().includes(filters.searchQuery.toLowerCase())) {
      return false;
    }

    // Apply category filter
    if (filters.category && event.category !== filters.category) {
      return false;
    }

    // Apply date range filter
    if (eventDate < filters.fromDate || eventDate > filters.toDate) {
      return false;
    }

    // Apply paid events filter
    if (filters.showPaidEvents && !event.isPaid) {
      return false;
    }

    // Apply distance filter if enabled
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

  console.log('Filtered events to show:', filteredEvents);

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
        <Marker position={userLocation}>
          <Popup>Your location</Popup>
        </Marker>

        {/* Event markers */}
        {filteredEvents?.map(event => {
          const lat = Number(event.latitude);
          const lng = Number(event.longitude);

          if (isNaN(lat) || isNaN(lng)) {
            console.error('Invalid coordinates for event:', event.title, lat, lng);
            return null;
          }

          return (
            <Marker
              key={event.id}
              position={[lat, lng]}
            >
              <Popup>
                <h3 className="font-bold">{event.title}</h3>
                <p>{event.description}</p>
                <p className="text-sm text-gray-600">
                  {format(new Date(event.startTime), "MMM d, yyyy 'at' h:mm a")}
                </p>
                {event.isPaid && (
                  <p className="text-sm font-semibold">
                    Price: €{Number(event.price).toFixed(2)}
                  </p>
                )}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}