import React from 'react';
import './streetview.css';
import { MapPin } from 'lucide-react';

interface StreetViewProps {
  latitude: number;
  longitude: number;
}

const StreetView: React.FC<StreetViewProps> = ({ latitude, longitude }) => {
  return (
    <div className="street-view-placeholder rounded-md overflow-hidden shadow-sm flex items-center justify-center bg-slate-100">
      <div className="text-center p-4">
        <MapPin className="h-6 w-6 mx-auto mb-2 text-primary" />
        <p className="text-sm text-slate-600">
          {latitude.toFixed(4)}, {longitude.toFixed(4)}
        </p>
      </div>
    </div>
  );
};

export default StreetView;