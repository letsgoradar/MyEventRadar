
import React, { useEffect, useRef } from 'react';
import * as Mapillary from '@mapillary/mapillary-js';
import '@mapillary/mapillary-js/dist/mapillary.css';
import './streetview.css';

interface StreetViewProps {
  latitude: number;
  longitude: number;
}

const StreetView: React.FC<StreetViewProps> = ({ latitude, longitude }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Mapillary.Viewer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Mapillary API key - this is a demo key, for production use your own key
    const apiKey = 'MLY|7444232575363003|1cdb91a84560bb4cc8cc11b2c8392feb';

    // Initialize Mapillary viewer
    const viewer = new Mapillary.Viewer({
      container: containerRef.current,
      apiClient: {
        clientId: apiKey,
      },
      component: {
        cover: false,
        bearing: true,
        spatial: true,
        zoom: true,
      },
    });

    viewerRef.current = viewer;

    // Retrieve the closest image to the given coordinates
    viewer.moveTo(`${longitude},${latitude}`).catch(error => {
      console.error('Error finding street view for location:', error);
    });

    return () => {
      if (viewerRef.current) {
        viewerRef.current.remove();
      }
    };
  }, [latitude, longitude]);

  return (
    <div className="relative rounded-md overflow-hidden shadow-sm">
      <div 
        ref={containerRef} 
        className="h-[200px] w-full"
      />
      <div className="absolute bottom-1 left-1 text-xs text-white bg-black/50 px-1 rounded">
        © Mapillary
      </div>
    </div>
  );
};

export default StreetView;
