
import React from 'react';
import { Event } from '@shared/schema';
import { MapPin, Calendar, Euro } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import CategoryIcon from './CategoryIcon';

// Fix Leaflet icon issues
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

const miniEventIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #ff4757; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

export const getCategoryColor = (category: string): string => {
  const colors = {
    'festival': '#FF6B00',
    'sport': '#0066FF',
    'music': '#4285F4',
    'food': '#FBBC05',
    'culture': '#7B1FA2',
    'market': '#34A853',
    'education': '#4A90E2',
    'other': '#757575',
  };
  
  return colors[category.toLowerCase()] || colors.other;
};

interface EventCardProps {
  event: Event;
  distance: number;
}

export default function EventCard({ event, distance }: EventCardProps) {
  const categoryColor = getCategoryColor(event.category);
  const eventCoords: [number, number] = [Number(event.latitude), Number(event.longitude)];

  return (
    <Card className="overflow-hidden h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <Badge variant="outline" style={{ backgroundColor: categoryColor, color: 'white' }} className="mb-2">
            {event.category}
          </Badge>
          <Badge variant="outline" className="bg-muted text-foreground">
            {distance.toFixed(1)} km
          </Badge>
        </div>
        <CardTitle className="text-lg md:text-xl line-clamp-2">{event.title}</CardTitle>
        <CardDescription className="flex items-center gap-1 text-xs">
          <MapPin size={14} />
          {event.locationName || `${event.latitude.toFixed(3)}, ${event.longitude.toFixed(3)}`}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pb-4 flex-grow grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="flex items-center text-sm">
            <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
            <span>
              {event.startTime 
                ? format(new Date(event.startTime), 'd MMMM yyyy', {locale: nl})
                : 'Datum onbekend'}
            </span>
          </div>
          
          {event.isPaid && (
            <div className="flex items-center text-sm">
              <Euro className="h-4 w-4 mr-2 text-muted-foreground" />
              <span>€{event.price}</span>
            </div>
          )}
          
          <div className="line-clamp-3 text-sm">
            {event.description || 'Geen beschrijving beschikbaar'}
          </div>
          
          <CategoryIcon 
            category={event.category} 
            size="md" 
            className="mt-2" 
          />
        </div>
        
        <div className="h-[120px] min-h-[100px] max-h-[150px] rounded-md overflow-hidden shadow-sm">
          <MapContainer 
            center={eventCoords} 
            zoom={14} 
            scrollWheelZoom={false}
            zoomControl={false}
            attributionControl={false}
            dragging={false}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
            />
            <Marker position={eventCoords} icon={miniEventIcon} />
          </MapContainer>
        </div>
      </CardContent>
    </Card>
  );
}
