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
  // Default to Oss center
  const [userLocation, setUserLocation] = useState<[number, number]>([51.7656, 5.5314]);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
          console.log('User location set to:', [position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.error("Location error:", error);
          // Keep default Oss center
          setMapReady(true);
        }
      );
    }
    setMapReady(true);
  }, []);

  const { data: events, isLoading, error } = useQuery<Event[]>({
    queryKey: ["/api/events/nearby", filters],
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
    console.log('Processing event:', event.title, {
      coordinates: [event.latitude, event.longitude],
      date: new Date(event.startTime)
    });

    // Validate coordinates
    if (!event.latitude || !event.longitude) {
      console.log('Event skipped - invalid coordinates:', event.title);
      return false;
    }

    const eventDate = new Date(event.startTime);

    // Apply date range filter
    if (eventDate < filters.fromDate || eventDate > filters.toDate) {
      console.log('Event skipped - outside date range:', event.title);
      return false;
    }

    // Apply search filter
    if (filters.searchQuery && !event.title.toLowerCase().includes(filters.searchQuery.toLowerCase())) {
      console.log('Event skipped - search mismatch:', event.title);
      return false;
    }

    // Apply category filter
    if (filters.category && event.category !== filters.category) {
      console.log('Event skipped - category mismatch:', event.title);
      return false;
    }

    // Apply paid events filter
    if (filters.showPaidEvents && !event.isPaid) {
      console.log('Event skipped - not paid:', event.title);
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
        console.log('Event skipped - too far:', event.title, distance.toFixed(1), 'km');
        return false;
      }
    }

    console.log('Event passed all filters:', event.title);
    return true;
  });

  if (isLoading) return <div>Loading map...</div>;
  if (error) return <div>Error loading events</div>;

  console.log('Showing filtered events:', filteredEvents?.length);

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
          // Parse coordinates as numbers
          const latitude = Number(event.latitude);
          const longitude = Number(event.longitude);

          // Skip invalid coordinates
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
                      Price: €{Number(event.price).toFixed(2)}
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