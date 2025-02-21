import { useMap } from "react-leaflet";
import { Search } from "lucide-react";

export default function LocationPin() {
  const map = useMap();
  
  return (
    <div className="leaflet-top leaflet-left">
      <div className="leaflet-control leaflet-bar">
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none">
          <div className="bg-gray-800 rounded-full p-2">
            <Search className="h-6 w-6 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}
