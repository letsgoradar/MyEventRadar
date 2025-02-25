import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Oss Summer Festival location
const OSS_EVENT = {
  title: "Oss Summer Festival",
  description: "Annual summer festival with live music and food stalls",
  location: [51.7656, 5.5314] as [number, number],
  date: "July 15th, 2024",
  price: 15
};

export default function MapView() {
  return (
    <div style={{ height: "calc(100vh - 8rem)" }}>
      <MapContainer
        center={OSS_EVENT.location}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        <Marker position={OSS_EVENT.location}>
          <Popup>
            <div className="text-lg font-bold">{OSS_EVENT.title}</div>
            <p>{OSS_EVENT.description}</p>
            <p className="text-sm">Date: {OSS_EVENT.date}</p>
            <p className="text-sm">Price: €{OSS_EVENT.price}</p>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}