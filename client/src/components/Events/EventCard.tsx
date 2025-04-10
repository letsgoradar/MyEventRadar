import React, { useState } from 'react';
import { Event } from '@shared/schema';
import { MapPin, Calendar, Euro, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from '@/components/ui/card';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { Button } from '@/components/ui/button';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CategoryIcon, CATEGORY_COLORS, getCategoryColor } from '../CategoryIcon';
import './leaflet-fix.css';
import StreetView from '../StreetView/StreetView';
import CountdownTimer from './CountdownTimer';
import { Link } from 'wouter';

function createEventIcon(category: string) {
  const color = getCategoryColor(category as any);
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
  gridView?: boolean;
}

export default function EventCard({ event, distance, gridView = false }: EventCardProps) {
  const [showStreetView, setShowStreetView] = useState(false);
  const eventCoords: [number, number] = [Number(event.latitude), Number(event.longitude)];
  const userLocation = { lat: 51.77344, lng: 5.537792 }; // Voorbeeld gebruikerslocatie

  // Bepaal of er een evenement afbeelding beschikbaar is
  // Voor nu alle evenementen zonder afbeelding tonen met een kaart
  // Later kan dit uitgebreid worden met een controle of er echt afbeeldingen zijn
  const hasEventImage = false;

  if (gridView) {
    return (
      <Link href={`/web/event/${event.id}`}>
        <Card className="overflow-hidden transition-all hover:shadow-md cursor-pointer h-full flex flex-col">
          {/* Afbeelding bovenaan met overlay voor categorie en afstand */}
          <div className="relative h-48 overflow-hidden">
            {hasEventImage ? (
              // Als er een afbeelding zou zijn, toon die hier
              <div className="bg-gray-200 h-full w-full flex items-center justify-center">
                <span className="text-gray-400">Event afbeelding</span>
              </div>
            ) : (
              // Als er geen afbeelding is, toon een kaart met een route naar het evenement
              <div className="h-full w-full">
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
                  
                  {/* Hier zou je een route of cirkel kunnen toevoegen naar de gebruiker */}
                </MapContainer>
              </div>
            )}
            
            {/* Overlay met categorie en afstand */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-white">
              <div className="flex justify-between items-center">
                <Badge style={{ 
                  backgroundColor: getCategoryColor(event.category as any),
                  color: 'white'
                }}>
                  {event.category}
                </Badge>
                
                <div className="bg-black/40 px-2 py-1 rounded-full flex items-center text-xs">
                  <MapPin className="h-3 w-3 mr-1" />
                  {distance !== undefined && typeof distance === 'number' 
                    ? `${distance.toFixed(1)} km` 
                    : 'Afstand onbekend'}
                </div>
              </div>
            </div>
          </div>
          
          {/* Content voor de kaart */}
          <CardHeader className="p-4 pb-2 flex-1">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <CategoryIcon category={event.category as any} className="flex-shrink-0" />
              {event.title}
            </CardTitle>
            
            <div className="mt-2">
              <CountdownTimer startTime={event.startTime} />
            </div>
          </CardHeader>
          
          <CardContent className="p-4 pt-0">
            <div className="line-clamp-2 text-sm mb-4">
              {event.description || 'Geen beschrijving beschikbaar'}
            </div>
            
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                {new Date(event.startTime).toLocaleDateString('nl-NL', {
                  day: 'numeric',
                  month: 'short'
                })}
              </div>
              
              {event.isPaid && (
                <div className="flex items-center">
                  <Euro className="h-4 w-4 mr-1" />
                  <span>{Number(event.price).toFixed(2)} EUR</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  // Originele lijstweergave
  return (
    <Link href={`/web/event/${event.id}`}>
      <Card className="overflow-hidden transition-all hover:shadow-md cursor-pointer">
        <CardHeader className="p-4 pb-0">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg font-bold line-clamp-1 flex items-center gap-2">
                <CategoryIcon category={event.category as any} className="flex-shrink-0" />
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
              backgroundColor: `${getCategoryColor(event.category as any)}20`,
              color: getCategoryColor(event.category as any)
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