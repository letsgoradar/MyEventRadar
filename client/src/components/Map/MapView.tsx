import { useEffect, useState } from "react";
import { MapContainer, TileLayer, useMap, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";
import LocationPin from "./LocationPin";
import EventOverlay from "./EventOverlay";

interface Location {
  lat: number;
  lng: number;
}

interface EventLocation extends Location {
  lat: number;
  lng: number;
}

function MapController({ center }: { center: Location }) {
  const map = useMap();

  useEffect(() => {
    map.setView([center.lat, center.lng], 13);
  }, [center, map]);

  return null;
}

export default function MapView() {
  const [userLocation, setUserLocation] = useState<Location>({ lat: 52.3676, lng: 4.9041 }); // Default to Amsterdam
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      });
    }
  }, []);

  const { data: events } = useQuery<Event[]>({
    queryKey: ["/api/events/nearby", userLocation.lat, userLocation.lng, 2], // 2km radius
  });

  const getEventLocation = (event: Event): EventLocation => {
    const location = event.location as EventLocation;
    return {
      lat: location.lat,
      lng: location.lng
    };
  };

  return (
    <div className="relative h-[calc(100vh-4rem)]">
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setSelectedEvent(null)} />
      )}
      <MapContainer
        center={[userLocation.lat, userLocation.lng]}
        zoom={13}
        className="h-full w-full"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MapController center={userLocation} />
        <LocationPin />

        {events?.map((event) => {
          const location = getEventLocation(event);
          return (
            <Marker
              key={event.id}
              position={[location.lat, location.lng]}
              eventHandlers={{
                click: () => setSelectedEvent(event),
              }}
            >
              <Popup>
                <h3 className="font-bold">{event.title}</h3>
                <p className="text-sm">{event.address}</p>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {selectedEvent && (
        <EventOverlay
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}