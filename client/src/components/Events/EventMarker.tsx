import { useState } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Event } from '@shared/schema';
import { CATEGORY_COLORS, getCategoryColor } from '../CategoryIcon';
import { format } from 'date-fns';
import './event-marker.css';
import { Link } from 'wouter';

interface EventMarkerProps {
  event: Event;
  onClick?: () => void;
}

function createEventIcon(category: string) {
  const color = getCategoryColor(category as any);
  return L.divIcon({
    className: 'event-marker',
    html: `
      <div style="
        width: 10px;
        height: 10px;
        background-color: ${color};
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 0 4px rgba(0,0,0,0.2);
      "></div>
    `,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });
}

export default function EventMarker({ event, onClick }: EventMarkerProps) {
  return (
    <Marker
      position={[Number(event.latitude), Number(event.longitude)]}
      icon={createEventIcon(event.category)}
      eventHandlers={{
        click: onClick
      }}
    >
      <Popup className="event-popup">
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