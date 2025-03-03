
import React, { useState, useEffect, useRef } from 'react';
import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Create a custom icon using Lucide's MapPin
const createCustomIcon = (color: string = '#0075ff') => {
  return L.divIcon({
    html: `<div style="color: ${color}; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
    </div>`,
    className: 'custom-marker-icon',
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -40]
  });
};

interface DraggableMarkerProps {
  position: [number, number];
  onPositionChange: (position: [number, number]) => void;
  color?: string;
}

export const DraggableMarker: React.FC<DraggableMarkerProps> = ({ 
  position, 
  onPositionChange,
  color = '#0075ff'
}) => {
  const [markerPosition, setMarkerPosition] = useState<[number, number]>(position);
  const markerRef = useRef<L.Marker>(null);
  const map = useMap();

  useEffect(() => {
    setMarkerPosition(position);
    if (markerRef.current) {
      markerRef.current.setLatLng(position);
    }
  }, [position]);

  const eventHandlers = {
    dragend() {
      const marker = markerRef.current;
      if (marker) {
        const newPos = marker.getLatLng();
        const newPosition: [number, number] = [newPos.lat, newPos.lng];
        setMarkerPosition(newPosition);
        onPositionChange(newPosition);
      }
    },
  };

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={markerPosition}
      ref={markerRef}
      icon={createCustomIcon(color)}
    />
  );
};
