import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React, { useState, useEffect } from 'react';
import './Map/leaflet-fix.css';

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
      position={[Number(event.latitude), Number(event.longitude)]}
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

  return (
    <MapContainer
      center={[52.3676, 4.9041]}
      zoom={13}
      className="h-full w-full"
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution={false}
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