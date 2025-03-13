import { useState, useEffect } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Event } from '@shared/schema';
import { CATEGORY_COLORS, CATEGORY_PATHS } from '../CategoryIcon';
import { differenceInHours } from 'date-fns';
import './event-marker.css';

interface EventMarkerProps {
  event: Event;
  onClick?: () => void;
}

function createEventIcon(category: string, isStartingSoon: boolean) {
  const color = CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] || '#94A3B8';
  const size = isStartingSoon ? 24 : 16;
  const iconPath = CATEGORY_PATHS[category as keyof typeof CATEGORY_PATHS];

  return L.divIcon({
    className: `custom-event-marker ${isStartingSoon ? 'starting-soon' : ''}`,
    html: `
      <div class="marker-inner" style="
        position: relative;
        width: ${size}px;
        height: ${size}px;
      ">
        <div style="
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: ${color};
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 0 4px rgba(0,0,0,0.2);
        "></div>
        <svg 
          viewBox="0 0 24 24" 
          width="${size-4}px" 
          height="${size-4}px" 
          fill="white"
          style="
            position: absolute;
            top: 2px;
            left: 2px;
          "
        >
          <path d="${iconPath}"/>
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