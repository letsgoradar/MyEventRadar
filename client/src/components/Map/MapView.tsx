import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";
import { format } from "date-fns";
import L from 'leaflet';
import "leaflet/dist/leaflet.css";

// Custom icon for event markers
const eventIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="8" fill="#f97316" stroke="white" stroke-width="2"/>
    </svg>

// Distance calculation function
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c * 10) / 10;
}

// City display component
function CityDisplay({ lat, lng }: { lat: number, lng: number }) {
  const [city, setCity] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchCity() {
      try {
        const response = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
        if (!response.ok) throw new Error('Failed to fetch city');
        const data = await response.json();
        setCity(data.city);
      } catch (error) {
        console.error('Error fetching city:', error);
        setCity(null);
      }
    }
    fetchCity();
  }, [lat, lng]);

  return city ? <p>City: {city}</p> : null;
}
</new_str>

  `),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

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

// Test data matching a known event from the database
const testEvents: Event[] = [
  {
    id: 42,
    title: "Muziekfestival Centrum Oss",
    description: "Jaarlijks muziekfestival met lokale bands",
    latitude: "51.7656",
    longitude: "5.5314",
    notificationReach: "5",
    startTime: new Date("2024-03-30T14:00:00"),
    endTime: new Date("2024-03-30T23:00:00"),
    category: "festival",
    subcategory: "music",
    isPaid: true,
    price: "15.00",
    hostId: 1,
    maxParticipants: 1000,
    recurrence: "once",
    locationName: "Centrum Oss" // Added locationName
  }
];

export default function MapView() {
  const [userLocation, setUserLocation] = useState<[number, number]>([51.7656, 5.5314]);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation: [number, number] = [position.coords.latitude, position.coords.longitude];
          setUserLocation(newLocation);
          mapRef.current?.setView(newLocation, 13);
          console.log('Set user location:', newLocation);
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  }, []);

  const { data: apiEvents } = useQuery<Event[]>({
    queryKey: ["/api/events/nearby", userLocation],
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: userLocation[0].toString(),
        lng: userLocation[1].toString(),
        radius: "50", // Large radius to show all events
      });

      console.log('Fetching nearby events:', Object.fromEntries(params));
      const response = await fetch(`/api/events/nearby?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }

      const data = await response.json();
      console.log('Received events from API:', data);
      return data;
    },
  });

  // Use test data if API call fails
  const events = apiEvents || testEvents;

  console.log('Processing events:', events.map(e => ({
    id: e.id,
    title: e.title,
    coords: [e.latitude, e.longitude]
  })));

  // Display events with valid coordinates
  const validEvents = events.filter(event => {
    // Check if event has location property
    if (!event.location) {
      const lat = Number(event.latitude);
      const lng = Number(event.longitude);
      return !isNaN(lat) && !isNaN(lng);
    }
    
    // Handle location object structure
    const location = event.location as { lat: number; lng: number };
    return !isNaN(location.lat) && !isNaN(location.lng);
  });

  console.log('Total valid events:', validEvents.length);

  return (
    <div className="h-[calc(100vh-8rem)]">
      <MapContainer
        center={userLocation}
        zoom={13}
        className="h-full w-full"
        ref={mapRef}
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
        {validEvents.map(event => {
          const coordinates = event.location 
            ? [event.location.lat, event.location.lng]
            : [Number(event.latitude), Number(event.longitude)];

          console.log('Adding marker for event:', {
            id: event.id,
            title: event.title,
            position: coordinates
          });

          return (
            <Marker
              key={event.id}
              position={coordinates as [number, number]}
              icon={eventIcon}
            >
              <Popup>
                <strong>{event.title}</strong><br />
                <p>{event.description}</p>
                <p>Category: {event.category}</p>
                {event.isPaid && <p>Price: €{event.price}</p>}
                {event.locationName && <p>Location: {event.locationName}</p>}
                <p>{calculateDistance(
                  userLocation[0],
                  userLocation[1],
                  coordinates[0],
                  coordinates[1]
                ).toFixed(1)} km away</p>
                <CityDisplay lat={coordinates[0]} lng={coordinates[1]} />
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}