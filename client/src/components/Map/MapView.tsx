import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";

// Oss als standaard centrum
const DEFAULT_CENTER: [number, number] = [51.7656, 5.5314];
const DEFAULT_ZOOM = 13;

// Haversine formule voor afstandsberekening
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Aarde radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Component om de kaart te updaten wanneer locatie verandert
function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

export default function MapView() {
  const [userLocation, setUserLocation] = useState<[number, number]>(DEFAULT_CENTER);

  // Gebruiker's locatie ophalen
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.error("Locatie fout:", error);
        }
      );
    }
  }, []);

  // Events ophalen
  const { data: events } = useQuery<Event[]>({
    queryKey: ["/api/events/nearby"],
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: userLocation[0].toString(),
        lng: userLocation[1].toString(),
        radius: "10", // 10km radius
      });

      const response = await fetch(`/api/events/nearby?${params}`);
      if (!response.ok) {
        throw new Error('Fout bij ophalen events');
      }
      const data = await response.json();
      console.log('Opgehaalde events:', data);
      return data;
    },
  });

  // Filter events binnen 10km
  const nearbyEvents = events?.filter(event => {
    const distance = calculateDistance(
      userLocation[0],
      userLocation[1],
      Number(event.latitude),
      Number(event.longitude)
    );
    return distance <= 10; // Toon alleen events binnen 10km
  });

  return (
    <div className="h-[calc(100vh-8rem)]">
      <MapContainer
        center={userLocation}
        zoom={DEFAULT_ZOOM}
        className="h-full w-full"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        <MapController center={userLocation} />

        {/* Marker voor gebruiker's locatie */}
        <Marker position={userLocation}>
          <Popup>Jouw locatie</Popup>
        </Marker>

        {/* Markers voor events */}
        {nearbyEvents?.map((event) => (
          <Marker
            key={event.id}
            position={[Number(event.latitude), Number(event.longitude)]}
          >
            <Popup>
              <strong>{event.title}</strong>
              <p>{event.description}</p>
              <p>Afstand: {calculateDistance(
                userLocation[0],
                userLocation[1],
                Number(event.latitude),
                Number(event.longitude)
              ).toFixed(1)} km</p>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}