import { format } from "date-fns";
import { Calendar, Users, Euro } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import type { Event } from "@shared/schema";
import "leaflet/dist/leaflet.css";

interface EventCardProps {
  event: Event;
  onSelect?: (event: Event) => void;
}

// Custom icon for the mini map marker
const miniEventIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6" fill="#f97316" stroke="white" stroke-width="2"/>
    </svg>
  `),
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export default function EventCard({ event, onSelect }: EventCardProps) {
  // Use correct column names from database schema
  const lat = Number(event.latitude);
  const lng = Number(event.longitude);

  return (
    <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-white" onClick={() => onSelect?.(event)}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold">{event.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{event.category}</Badge>
              {event.subcategory && (
                <Badge variant="outline" className="bg-slate-50">
                  {event.subcategory}
                </Badge>
              )}
            </div>
          </div>
          {event.isPaid && event.price && (
            <Badge variant="secondary" className="text-lg">
              €{Number(event.price).toFixed(2)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="h-[150px] rounded-md overflow-hidden relative border-2 border-gray-200">
            <MapContainer
              center={[lat, lng]}
              zoom={14}
              className="h-full w-full"
              zoomControl={false}
              dragging={false}
              touchZoom={false}
              doubleClickZoom={false}
              scrollWheelZoom={false}
              attributionControl={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[lat, lng]} icon={miniEventIcon} />
            </MapContainer>
          </div>

          <div className="flex items-center text-gray-600">
            <Calendar className="h-4 w-4 mr-2" />
            <span className="text-sm">
              {format(new Date(event.startTime), "MMM d, yyyy 'at' h:mm a")}
              {event.endTime && ` - ${format(new Date(event.endTime), "h:mm a")}`}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {event.maxParticipants && (
              <div className="flex items-center text-gray-600">
                <Users className="h-4 w-4 mr-2" />
                <span className="text-sm">
                  Max: {event.maxParticipants}
                </span>
              </div>
            )}
          </div>

          <p className="text-sm text-gray-600 mt-2">
            {event.description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}