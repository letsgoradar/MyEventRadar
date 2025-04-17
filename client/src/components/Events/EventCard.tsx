import React, { useState, useEffect } from 'react';
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
import { useLocation } from '@/hooks/useLocation';

function createEventIcon(category: string, isExpired: boolean = false) {
  // Gebruik lichtgrijs voor verlopen evenementen, anders de categorie kleur
  const color = isExpired ? '#BBBBBB' : getCategoryColor(category as any);
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

// Functie om afstand tussen twee coördinaten te berekenen (Haversine formule)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius van de aarde in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Afstand in km
  return parseFloat(distance.toFixed(1));
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

interface EventCardProps {
  event: Event;
  distance?: number;
  gridView?: boolean;
}

export default function EventCard({ event, distance, gridView = false }: EventCardProps) {
  const [showStreetView, setShowStreetView] = useState(false);
  const eventCoords: [number, number] = [Number(event.latitude), Number(event.longitude)];
  
  // Haal de huidige locatie op
  const { location } = useLocation();
  
  // State voor berekende afstand
  const [calculatedDistance, setCalculatedDistance] = useState<number | undefined>(distance);
  
  // Controleer of het evenement verlopen is
  const isExpired = event.endTime ? new Date(event.endTime) < new Date() : false;
  
  // Update afstand wanneer locatie verandert of distance prop verandert
  useEffect(() => {
    if (distance !== undefined) {
      setCalculatedDistance(distance);
    } else if (location) {
      const dist = calculateDistance(
        location.lat,
        location.lng,
        Number(event.latitude),
        Number(event.longitude)
      );
      setCalculatedDistance(dist);
    }
  }, [location, distance, event.latitude, event.longitude]);

  // Bepaal of er een evenement afbeelding beschikbaar is
  // Controleer of er een imageUrl is als property van het event object
  const hasEventImage = !!(event as any).imageUrl;

  if (gridView) {
    return (
      <Link href={`/web/event/${event.id}`}>
        <Card className="overflow-hidden transition-all hover:shadow-md cursor-pointer h-full flex flex-col">
          {/* Afbeelding bovenaan met overlay voor categorie en afstand */}
          <div className="relative h-48 overflow-hidden">
            {hasEventImage ? (
              // Toon de afbeelding van het evenement
              <div className="h-full w-full">
                <img 
                  src={(event as any).imageUrl} 
                  alt={event.title} 
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              // Als er geen afbeelding is, toon een kaart met een route naar het evenement als achtergrond
              <div className="h-full w-full">
                <div className="absolute inset-0 z-0">
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
                      opacity={0.7} // Maak de kaart iets transparanter
                    />
                    <Marker position={eventCoords} icon={createEventIcon(event.category, isExpired)} />
                  </MapContainer>
                </div>
                
                {/* Semi-transparante overlay over de gehele kaart voor beter leesbaarheid - alleen in tegelweergave (gridView), niet in kaartweergave */}
                {window.location.pathname.includes('/web') && (
                  <div className="absolute inset-0 bg-black/20 z-10"></div>
                )}
              </div>
            )}
            
            {/* Overlay met titel preview en afstand - alleen in tegelweergave (gridView), niet in kaartweergave */}
            {window.location.pathname.includes('/web') && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-white z-20">
                <div className="flex justify-between items-start">
                  <div className="flex-1 truncate mr-2">
                    <div className="flex items-center gap-1.5">
                      <CategoryIcon category={event.category as any} className="h-4 w-4 flex-shrink-0" />
                      <h3 className="text-lg font-semibold truncate">{event.title}</h3>
                    </div>
                  </div>
                  
                  <div className="bg-black/60 px-2 py-1 rounded-full flex items-center text-xs font-medium shadow-sm flex-shrink-0">
                    <MapPin className="h-3 w-3 mr-1" />
                    {calculatedDistance !== undefined && typeof calculatedDistance === 'number' 
                      ? `${calculatedDistance.toFixed(1)} km` 
                      : 'Afstand onbekend'}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Content voor de kaart */}
          <CardHeader className="p-4 pb-2 flex-1">
            <CardTitle className="text-lg font-bold">
              {event.title}
            </CardTitle>
            
            <div className="flex items-center gap-2 mt-1 text-gray-500">
              <CategoryIcon category={event.category as any} className="flex-shrink-0 h-4 w-4" />
              <div className="text-xs">
                {calculatedDistance !== undefined && typeof calculatedDistance === 'number' 
                  ? `${calculatedDistance.toFixed(1)} km` 
                  : 'Afstand onbekend'}
              </div>
            </div>
            
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
        <div className="flex flex-col md:flex-row">
          {/* Afbeelding links */}
          <div className="md:w-1/3 h-[180px] md:h-auto relative">
            {hasEventImage ? (
              <img 
                src={(event as any).imageUrl} 
                alt={event.title} 
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full relative">
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
                  <Marker position={eventCoords} icon={createEventIcon(event.category, isExpired)} />
                </MapContainer>
              </div>
            )}
            
            {/* Titel preview overlay - alleen in lijstweergave, niet op de kaart zelf */}
            {window.location.pathname.includes('/web') && (
              <div className="absolute top-2 left-2 right-2 z-10">
                <div className="flex items-center gap-1.5 text-white bg-black/60 px-2 py-1 rounded shadow">
                  <CategoryIcon category={event.category as any} className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate text-lg font-semibold">{event.title}</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Content rechts */}
          <div className="md:w-2/3 flex flex-col">
            <CardHeader className="p-4 pb-0">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg font-bold line-clamp-1">
                    {event.title}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1 text-gray-500">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span className="text-xs">
                        {calculatedDistance !== undefined && typeof calculatedDistance === 'number' 
                          ? `${calculatedDistance.toFixed(1)} km` 
                          : 'Afstand onbekend'}
                      </span>
                    </div>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 pt-2 flex-1 flex flex-col">
              <div className="flex flex-col gap-2 mb-4">
                <CountdownTimer startTime={event.startTime} />

                {event.isPaid && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Euro className="h-3 w-3" />
                    <span>{Number(event.price).toFixed(2)} EUR</span>
                  </div>
                )}
              </div>

              <div className="flex-1">
                <div className="line-clamp-3 text-sm">
                  {event.description || 'Geen beschrijving beschikbaar'}
                </div>
              </div>
              
              <div className="flex justify-between items-center text-sm text-muted-foreground mt-4">
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  {new Date(event.startTime).toLocaleDateString('nl-NL', {
                    day: 'numeric',
                    month: 'short'
                  })}
                </div>
                
                <div className="flex items-center">
                  {new Date(event.startTime).toLocaleTimeString('nl-NL', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </CardContent>
          </div>
        </div>
      </Card>
    </Link>
  );
}