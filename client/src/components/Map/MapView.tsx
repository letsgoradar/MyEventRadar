import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";
//import L from "leaflet"; //Removed as custom icon is no longer needed

// Default center (Oss)
const DEFAULT_CENTER: [number, number] = [51.7656, 5.5314];

export default function MapView() {
  // Fetch events
  const { data: events } = useQuery<Event[]>({
    queryKey: ["/api/events/nearby"],
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: DEFAULT_CENTER[0].toString(),
        lng: DEFAULT_CENTER[1].toString(),
        radius: "10" // 10km radius
      });

      const response = await fetch(`/api/events/nearby?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      const data = await response.json();
      console.log('Events data:', data); // Debug log
      return data;
    }
  });

  return (
    <div style={{ height: "calc(100vh - 8rem)" }}>
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {events?.map(event => {
          const lat = Number(event.latitude);
          const lng = Number(event.longitude);

          console.log(`Adding marker for event ${event.title} at ${lat},${lng}`); // Debug log

          return (
            <Marker
              key={event.id}
              position={[lat, lng]}
            >
              <Popup>
                <h3 style={{ fontWeight: 'bold' }}>{event.title}</h3>
                <p>{event.description}</p>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}