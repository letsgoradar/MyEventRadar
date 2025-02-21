import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React, { useState, useEffect } from 'react';

function LocationMarker() {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const map = useMap();

  useEffect(() => {
    map.locate().on("locationfound", function (e) {
      setPosition(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
    });
  }, [map]);

  return position === null ? null : (
    <Marker 
      position={position}
      icon={L.divIcon({
        className: 'custom-icon',
        html: '<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white pulse-animation"></div>'
      })}
    >
      <Popup>You are here</Popup>
    </Marker>
  );
}

function EventMarker({ event, viewed }: { event: any; viewed: boolean }) {
  return (
    <Marker
      position={[event.location.lat, event.location.lng]}
      icon={L.divIcon({
        className: 'custom-icon',
        html: `<div class="w-4 h-4 ${viewed ? 'bg-white' : 'bg-orange-500'} rounded-full border-2 border-gray-300"></div>`
      })}
    >
      <Popup>
        <h3 className="font-bold">{event.title}</h3>
        <p>{event.description}</p>
      </Popup>
    </Marker>
  );
}

function Map() {
  const [events, setEvents] = useState([]);
  const [viewedEvents, setViewedEvents] = useState<Set<number>>(new Set());

  // Fetch events and handle viewed state...  This section needs implementation to fetch and manage event data.

  return (
    <MapContainer
      center={[52.3676, 4.9041]}
      zoom={13}
      className="h-full w-full"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <LocationMarker />
      {events.map((event: any) => (
        <EventMarker 
          key={event.id} 
          event={event} 
          viewed={viewedEvents.has(event.id)} 
        />
      ))}
    </MapContainer>
  );
}

export default Map;