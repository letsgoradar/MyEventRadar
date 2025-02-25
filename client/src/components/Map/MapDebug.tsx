
import { useEffect } from 'react';
import type { Event } from '@shared/schema';

interface MapDebugProps {
  events: Event[];
  userLocation: [number, number];
}

export function MapDebug({ events, userLocation }: MapDebugProps) {
  useEffect(() => {
    console.log('Debug Info:');
    console.log('User Location:', userLocation);
    console.log('Number of Events:', events.length);
    console.log('Event Coordinates:');
    events.forEach(event => {
      console.log(`${event.title}: [${event.latitude}, ${event.longitude}]`);
    });
  }, [events, userLocation]);

  return null;
}
