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
    recurrence: "once"
  }
];

export default function MapView({ filters }: MapViewProps) {
  // Default to Oss center
  const [userLocation, setUserLocation] = useState<[number, number]>([51.7656, 5.5314]);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
          console.log('Set user location:', [position.coords.latitude, position.coords.longitude]);
        },
        () => {
          console.log('Using default location (Oss):', userLocation);
        }
      );
    }
  }, []);

  const { data: apiEvents } = useQuery<Event[]>({
    queryKey: ["/api/events/nearby", filters, userLocation],
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: userLocation[0].toString(),
        lng: userLocation[1].toString(),
        radius: filters.useDistanceFilter ? filters.distanceRadius.toString() : "10",
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
    const lat = Number(event.latitude);
    const lng = Number(event.longitude);

    const isValid = !isNaN(lat) && !isNaN(lng);

    if (!isValid) {
      console.log('Invalid coordinates for event:', {
        title: event.title,
        latitude: event.latitude,
        longitude: event.longitude
      });
    } else {
      console.log('Valid event coordinates:', {
        title: event.title,
        coordinates: [lat, lng]
      });
    }

    return isValid;
  });

  console.log('Total valid events:', validEvents.length);

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
        {validEvents.map(event => {
          const lat = Number(event.latitude);
          const lng = Number(event.longitude);

          console.log('Adding marker for event:', {
            id: event.id,
            title: event.title,
            position: [lat, lng]
          });

          return (
            <Marker
              key={event.id}
              position={[lat, lng]}
              icon={eventIcon}
            >
              <Popup>
                <strong>{event.title}</strong><br />
                <p>{event.description}</p>
                <p>Category: {event.category}</p>
                {event.isPaid && <p>Price: €{event.price}</p>}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}