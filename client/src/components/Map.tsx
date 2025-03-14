import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './Map/leaflet-fix.css';

function Map() {
  return (
    <MapContainer
      center={[52.3676, 4.9041]}
      zoom={13}
      className="h-full w-full"
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution={false}
      />
    </MapContainer>
  );
}

export default Map;