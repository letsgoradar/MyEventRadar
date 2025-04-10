import { useState, useEffect } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Event } from '@shared/schema';
import { CATEGORY_COLORS } from '../CategoryIcon';
import { format } from 'date-fns';
import './event-marker.css';
import { Link } from 'wouter';

interface EventMarkerProps {
  event: Event;
  onClick?: () => void;
  isHighlighted?: boolean;
}

function createEventIcon(category: keyof typeof CATEGORY_COLORS, isHighlighted: boolean = false) {
  const color = CATEGORY_COLORS[category] || '#94A3B8';
  const size = isHighlighted ? 14 : 10;
  const borderWidth = isHighlighted ? 3 : 2;
  const pulseEffect = isHighlighted 
    ? `animation: pulse 1.5s infinite; box-shadow: 0 0 0 0 rgba(${hexToRgb(color)}, 0.7);` 
    : '';
  
  return L.divIcon({
    className: 'event-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background-color: ${color};
        border-radius: 50%;
        border: ${borderWidth}px solid white;
        box-shadow: 0 0 ${isHighlighted ? '8' : '4'}px rgba(0,0,0,0.2);
        ${pulseEffect}
      "></div>
    `,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
  });
}

// Helper function to convert hex to rgb for animation
function hexToRgb(hex: string) {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse the hex values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return `${r}, ${g}, ${b}`;
}

export default function EventMarker({ event, onClick, isHighlighted = false }: EventMarkerProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Auto-open popup when highlighted
  useEffect(() => {
    if (isHighlighted && !isOpen) {
      setIsOpen(true);
    }
  }, [isHighlighted, isOpen]);

  return (
    <Marker
      position={[Number(event.latitude), Number(event.longitude)]}
      icon={createEventIcon(event.category as keyof typeof CATEGORY_COLORS, isHighlighted)}
      eventHandlers={{
        click: () => {
          if (onClick) onClick();
          setIsOpen(true);
        }
      }}
    >
      <Popup 
        className="event-popup"
        autoClose={false}
        closeOnClick={false}
      >
        <div className="p-2">
          <div className="font-semibold text-lg mb-1">{event.title}</div>
          <div className="text-sm text-gray-600 mb-2">
            {format(new Date(event.startTime), 'dd MMM yyyy, HH:mm')}
          </div>
          {event.description && (
            <div className="text-sm text-gray-700 mb-2">
              {event.description.substring(0, 100)}
              {event.description.length > 100 ? '...' : ''}
            </div>
          )}
          <Link
            to={`/event/${event.id}`}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Bekijk details →
          </Link>
        </div>
      </Popup>
    </Marker>
  );
}