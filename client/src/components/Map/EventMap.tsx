import { useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import type { EventInterface as Event } from "@shared/schema";
import "leaflet/dist/leaflet.css";

interface EventMapProps {
  events: Event[];
  onEventClick?: (event: Event) => void;
  center?: [number, number];
  zoom?: number;
}

export default function EventMap({ events, onEventClick, center = [52.3676, 4.9041], zoom = 12 }: EventMapProps) {
  const [isSatelliteView, setIsSatelliteView] = useState(true);

  return (
    <div className="relative h-full">
      {/* Event count overlay */}
      <div className="absolute top-4 left-4 z-[1000] bg-white/90 px-4 py-2 rounded-full shadow-md">
        <span className="font-medium text-gray-700">
          {events.length} evenement{events.length !== 1 ? 'en' : ''} gevonden
        </span>
      </div>

      <MapContainer
        center={center}
        zoom={zoom}
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer
          url={isSatelliteView
            ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            : `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?api_key=${import.meta.env.VITE_CARTO_BASEMAP_KEY}`
          }
          {...(isSatelliteView ? { subdomains: [] } : { subdomains: 'abcd' })}
        />
      </MapContainer>
    </div>
  );
}