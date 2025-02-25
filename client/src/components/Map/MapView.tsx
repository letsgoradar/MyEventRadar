
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";
import L from 'leaflet';
import "leaflet/dist/leaflet.css";

// Custom icon for events
const eventIcon = L.icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="8" fill="#f97316" stroke="white" stroke-width="2"/>
    </svg>
  `),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function LocationMarker() {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const map = useMap();

  useEffect(() => {
    map.locate().on("locationfound", function (e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
      map.flyTo(e.latlng, map.getZoom());
    });
  }, [map]);

  return position === null ? null : (
    <Marker 
      position={position}
      icon={L.divIcon({
        className: 'custom-icon',
        html: '<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white"></div>'
      })}
    >
      <Popup>Your location</Popup>
    </Marker>
  );
}

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

export default function MapView() {
  const [userLocation, setUserLocation] = useState<[number, number]>([51.7656, 5.5314]);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation([position.coords.latitude, position.coords.longitude]);
      },
      (error) => {
        console.error("Error getting user location:", error);
      }
    );
  }, []);

  const { data: events } = useQuery<Event[]>({
    queryKey: ["/api/events/nearby", userLocation],
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: userLocation[0].toString(),
        lng: userLocation[1].toString(),
        radius: "50",
      });

      const response = await fetch(`/api/events/nearby?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      return response.json();
    },
  });

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
        
        <LocationMarker />

        {events?.map((event) => {
          const lat = Number(event.latitude);
          const lng = Number(event.longitude);
          
          if (isNaN(lat) || isNaN(lng)) {
            return null;
          }

          return (
            <Marker
              key={event.id}
              position={[lat, lng]}
              icon={eventIcon}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-bold">{event.title}</h3>
                  <p className="text-sm">{event.description}</p>
                  {event.category && (
                    <p className="text-sm mt-1">Category: {event.category}</p>
                  )}
                  {event.isPaid && (
                    <p className="text-sm">Price: €{event.price}</p>
                  )}
                  <p className="text-sm mt-1">
                    Distance: {calculateDistance(
                      userLocation[0],
                      userLocation[1],
                      lat,
                      lng
                    )} km
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
