import { useState, useEffect } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Event } from '@shared/schema';
import { CategoryIcon, CATEGORY_COLORS, CATEGORY_ICONS } from '../CategoryIcon'; // Assuming CATEGORY_ICONS is defined here
import { differenceInHours } from 'date-fns';
import './event-marker.css';

interface EventMarkerProps {
  event: Event;
  onClick?: () => void;
}

function createEventIcon(category: string, isStartingSoon: boolean) {
  const color = CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] || '#94A3B8';
  const size = isStartingSoon ? 24 : 16;
  const IconComponent = CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS];

  return L.divIcon({
    className: `custom-event-marker ${isStartingSoon ? 'starting-soon' : ''}`,
    html: `
      <div style="
        background-color: ${color};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: 2px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
      ">
        <svg viewBox="0 0 24 24" width="${size-4}px" height="${size-4}px" fill="currentColor">
          ${IconComponent().props.children.props.d}
        </svg>
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
      icon={createEventIcon(event.category, isStartingSoon)}
      eventHandlers={{
        click: onClick
      }}
    >
      <Popup>
        <div className="font-medium">{event.title}</div>
        <div className="text-sm text-gray-600">{event.category}</div>
      </Popup>
    </Marker>
  );
}