import { useState, useEffect } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Event } from '@shared/schema';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../CategoryIcon';
import { differenceInHours } from 'date-fns';
import './event-marker.css';
import { Link } from 'wouter';

interface EventMarkerProps {
  event: Event;
  onClick?: () => void;
}

function createEventIcon(category: keyof typeof CATEGORY_COLORS, isStartingSoon: boolean) {
  const color = CATEGORY_COLORS[category] || '#94A3B8';
  const IconComponent = CATEGORY_ICONS[category];
  const size = isStartingSoon ? 32 : 24;

  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size/2}" cy="${size/2}" r="${(size/2)-1}" fill="${color}" stroke="white" stroke-width="2"/>
      ${IconComponent ? `<path d="${IconComponent}" fill="white" transform="translate(${size/4} ${size/4}) scale(0.5)"/>` : ''}
    </svg>
  `;

  return L.divIcon({
    className: `event-marker ${isStartingSoon ? 'starting-soon' : ''}`,
    html: svg,
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
        <div className="text-sm pb-1">
          <div className="font-semibold mb-1">{event.title}</div>
          {event.description && (
            <div className="mb-2 text-xs text-gray-600">
              {event.description.substring(0, 80)}
              {event.description.length > 80 ? '...' : ''}
            </div>
          )}
          <Link
            to={`/event/${event.id}`}
            className="text-blue-600 hover:text-blue-800 underline text-xs"
          >
            Details bekijken
          </Link>
        </div>
      </Popup>
    </Marker>
  );
}