import React, { useState } from 'react';
import { Event } from '@shared/schema';
import { MapPin, Calendar, Euro, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from '@/components/ui/card';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { Button } from '@/components/ui/button';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CategoryIcon, CATEGORY_COLORS } from '../CategoryIcon';
import './leaflet-fix.css';
import StreetView from '../StreetView/StreetView';
import CountdownTimer from './CountdownTimer';
import { Link } from 'wouter';

function createEventIcon(category: string) {
  const color = CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] || '#94A3B8';
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

interface EventCardProps {
  event: Event;
  distance?: number;
}

export default function EventCard({ event, distance }: EventCardProps) {
  const [showStreetView, setShowStreetView] = useState(false);
  const eventCoords: [number, number] = [Number(event.latitude), Number(event.longitude)];

  return (
    <Link href={`/event/${event.id}`}>
      <Card className="overflow-hidden transition-all hover:shadow-md cursor-pointer">
        <CardHeader className="p-4 pb-0">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg font-bold line-clamp-1 flex items-center gap-2">
                <CategoryIcon category={event.category} className="flex-shrink-0" />
                {event.title}
              </CardTitle>
              <CardDescription className="flex items-center gap-1 mt-1 text-gray-500">
                <MapPin className="h-3 w-3" />
                <span className="text-xs">
                  {distance !== undefined && typeof distance === 'number' 
                    ? `${distance.toFixed(1)} km` 
                    : 'Afstand onbekend'}
                </span>
              </CardDescription>
            </div>
            <Badge variant="outline" style={{ 
              backgroundColor: `${CATEGORY_COLORS[event.category as keyof typeof CATEGORY_COLORS]}20`,
              color: CATEGORY_COLORS[event.category as keyof typeof CATEGORY_COLORS]
            }}>
              {event.category}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-2">
          <div className="flex flex-col gap-2 mb-4">
            <CountdownTimer startTime={event.startTime} />

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
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium">Locatie</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2 text-xs"
                  onClick={(e) => {
                    e.preventDefault(); // Voorkom navigatie naar event detail
                    setShowStreetView(!showStreetView);
                  }}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  {showStreetView ? 'Toon kaart' : 'Toon locatie'}
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
                    <Marker position={eventCoords} icon={createEventIcon(event.category)} />
                  </MapContainer>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}