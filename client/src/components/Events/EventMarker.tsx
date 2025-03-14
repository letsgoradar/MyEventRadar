import { useState, useEffect } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Event } from '@shared/schema';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../CategoryIcon';
import { differenceInHours, format } from 'date-fns';
import './event-marker.css';
import { Link } from 'wouter';

interface EventMarkerProps {
  event: Event;
  onClick?: () => void;
}

function createEventIcon(category: keyof typeof CATEGORY_COLORS, isStartingSoon: boolean) {
  const color = CATEGORY_COLORS[category] || '#94A3B8';
  const IconComponent = CATEGORY_ICONS[category];
  const size = isStartingSoon ? 24 : 20;

  return L.divIcon({
    className: `event-marker ${isStartingSoon ? 'starting-soon' : ''}`,
    html: `
      <div class="marker-inner" style="
        width: ${size}px;
        height: ${size}px;
        background-color: ${color};
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 0 4px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
      ">
        ${IconComponent ? `<div style="width: ${size-8}px; height: ${size-8}px;">${IconComponent}</div>` : ''}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
  });
}

export default function EventMarker({ event, onClick }: EventMarkerProps) {
  const [isStartingSoon, setIsStartingSoon] = useState(false);

  useEffect(() => {
    // Check if event starts within the next 2 hours
    const hoursUntilStart = differenceInHours(new Date(event.startTime), new Date());
    setIsStartingSoon(hoursUntilStart >= 0 && hoursUntilStart <= 2);
  }, [event.startTime]);

  return (
    <Marker
      position={[Number(event.latitude), Number(event.longitude)]}
      icon={createEventIcon(event.category as keyof typeof CATEGORY_COLORS, isStartingSoon)}
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