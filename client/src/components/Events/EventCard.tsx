import React, { useState } from 'react';
import { Event } from '@shared/schema';
import { MapPin, Calendar, Euro, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { Button } from '@/components/ui/button';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import CategoryIcon from './CategoryIcon';
import './leaflet-fix.css';
import StreetView from '../StreetView/StreetView';

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

interface EventCardProps {
  event: Event;
  distance: number;
}

export default function EventCard({ event, distance }: EventCardProps) {
  const [showStreetView, setShowStreetView] = useState(false);
  const eventCoords: [number, number] = [Number(event.latitude), Number(event.longitude)];

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <CardHeader className="p-4 pb-0">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg font-bold line-clamp-1 flex items-center gap-2">
              <CategoryIcon category={event.category} size="sm" className="flex-shrink-0" />
              {event.title}
            </CardTitle>
            <CardDescription className="flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3" />
              <span className="text-xs">{distance.toFixed(1)} km</span>
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-primary/10 text-primary text-xs">
            {event.category}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-2">
        <div className="flex flex-col gap-2 mb-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>
              {format(new Date(event.startTime), 'd MMMM yyyy', { locale: nl })}
            </span>
          </div>

          {event.isPaid && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Euro className="h-3 w-3" />
              <span>{Number(event.price).toFixed(2)} EUR</span>
            </div>
          )}
        </div>

        {/* Responsive layout - side by side on larger screens */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="line-clamp-3 text-sm">
              {event.description || 'Geen beschrijving beschikbaar'}
            </div>

            {/* Removed Icon */}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium">Locatie</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2 text-xs"
                onClick={() => setShowStreetView(!showStreetView)}
              >
                <Eye className="h-3 w-3 mr-1" />
                {showStreetView ? 'Toon kaart' : 'Toon straatbeeld'}
              </Button>
            </div>
            
            <div className="h-[150px] min-h-[100px] md:min-w-[150px] md:max-w-[200px] rounded-md overflow-hidden shadow-sm event-card-map">
              {showStreetView ? (
                <StreetView latitude={eventCoords[0]} longitude={eventCoords[1]} />
              ) : (
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
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}