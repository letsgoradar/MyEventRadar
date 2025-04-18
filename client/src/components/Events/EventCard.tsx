import React, { useState, useEffect } from 'react';
import { Event } from '@shared/schema';
import { MapPin, Calendar, Euro, Eye, Image } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CategoryIcon, CATEGORY_COLORS, getCategoryColor } from '../CategoryIcon';
import CountdownTimer from './CountdownTimer';
import { Link } from 'wouter';
import { useLocation } from '@/hooks/useLocation';
import placeholderImage from '@/assets/placeholder-event.svg';

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
  
  // Controleer de status van het evenement (bezig, verlopen, toekomstig)
  const now = new Date();
  const startTime = new Date(event.startTime);
  const endTime = event.endTime ? new Date(event.endTime) : new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // Default 2 uur
  
  const isExpired = endTime < now;
  const isOngoing = startTime <= now && endTime >= now;
  const isStartingSoon = !isOngoing && !isExpired && 
                       (startTime.getTime() - now.getTime()) < 24 * 60 * 60 * 1000;
  
  // Check de huidige weergavemodus (lijst/kaart)
  // Probeer de view uit URL te halen, standaard is 'list'
  const view = window.location.pathname.includes('/map') ? 'map' : 'list';
  
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
  
  // Check of we op een App2 pagina met map view zijn (om events in kaartweergave te verbergen)
  const isApp2MapView = window.location.pathname.includes('/app2') && 
                        (window.location.search.includes('view=map') || 
                         document.getElementById('map-container') !== null);

  // Bepaal of er een evenement afbeelding beschikbaar is
  // Het imageUrl veld kan null of undefined zijn, dus we moeten controleren of het bestaat
  const hasEventImage = !!event.imageUrl;

  if (gridView) {
    return (
      <Link href={`/web/event/${event.id}`}>
        <Card className="overflow-hidden transition-all hover:shadow-md cursor-pointer h-full flex flex-col event-card">
          {/* Afbeelding bovenaan met overlay voor categorie en afstand */}
          <div className="relative h-48 overflow-hidden">
            {hasEventImage ? (
              // Toon de afbeelding van het evenement
              <div className="h-full w-full">
                <img 
                  src={event.imageUrl || ''} 
                  alt={event.title} 
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              // Als er geen afbeelding is, toon een placeholder
              <div className="h-full w-full bg-gray-100 flex items-center justify-center">
                <div className="flex flex-col items-center justify-center text-gray-500">
                  <Image className="h-8 w-8 mb-2 opacity-50" />
                  <span className="text-xs text-center">Geen afbeelding beschikbaar</span>
                </div>
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
                      ? `${calculatedDistance.toFixed(1)} km van jouw huidige locatie` 
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
                  ? `${calculatedDistance.toFixed(1)} km van jouw huidige locatie` 
                  : 'Afstand onbekend'}
              </div>
            </div>
            
            <div className="mt-2">
              {isOngoing && (
                <div className="bg-green-100 text-green-800 px-2 py-1 rounded-md text-xs font-medium inline-flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                  Event is nu bezig
                </div>
              )}
              {isExpired && (
                <div className="bg-red-100 text-red-800 px-2 py-1 rounded-md text-xs font-medium inline-flex items-center">
                  <span className="w-2 h-2 bg-red-500 rounded-full mr-1.5"></span>
                  Event is verlopen
                </div>
              )}
              {!isOngoing && !isExpired && !isStartingSoon && (
                <CountdownTimer startTime={event.startTime} />
              )}
              {isStartingSoon && (
                <div className="bg-green-100 text-green-800 px-2 py-1 rounded-md text-xs font-medium inline-flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                  Start binnen 24 uur
                </div>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="p-4 pt-0">
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                <span>
                  {new Date(event.startTime).toLocaleDateString('nl-NL', {
                    day: 'numeric',
                    month: 'short'
                  })} om {new Date(event.startTime).toLocaleTimeString('nl-NL', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              
              {event.isPaid && (
                <div className="flex items-center ml-auto">
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

  // De nieuwe mobiele App2 lijst weergave
  if (window.location.pathname.includes('/app2')) {
    // Bij kaartweergave, toon geen event cards
    if (isApp2MapView || document.querySelector('.map-view-content')) {
      return null;
    }
    
    // Bereken of het evenement binnen 24 uur begint
    const now = new Date();
    const startTime = new Date(event.startTime);
    const isStartingSoon = !isOngoing && !isExpired && 
                          (startTime.getTime() - now.getTime()) < 24 * 60 * 60 * 1000;
    
    // Formateer de datum als "vrijdag 18 april om 16:23"
    const formattedDate = new Date(event.startTime).toLocaleDateString('nl-NL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    }) + " om " + new Date(event.startTime).toLocaleTimeString('nl-NL', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Bereken een ruwe schatting van de resterende tijd (voor countdowntekst)
    const timeUntilStart = startTime.getTime() - now.getTime();
    const hoursUntilStart = Math.floor(timeUntilStart / (1000 * 60 * 60));
    let countdownText = `over ongeveer ${hoursUntilStart} uur`;
    if (hoursUntilStart < 1) {
      const minutesUntilStart = Math.floor(timeUntilStart / (1000 * 60));
      countdownText = `over ongeveer ${minutesUntilStart} minuten`;
    }
    
    return (
      <Link href={`/app2/event/${event.id}`}>
        <Card className="overflow-hidden mb-4 transition-all hover:shadow-md cursor-pointer event-card">
          <div className="p-0">
            {/* Afbeelding container bovenaan */}
            <div className="w-full h-48 relative bg-gray-100">
              {hasEventImage ? (
                <img 
                  src={event.imageUrl || ''} 
                  alt={event.title} 
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <div className="flex flex-col items-center justify-center text-gray-500">
                    <Image className="h-12 w-12 mb-2 opacity-50" />
                    <span className="text-sm text-center">Geen afbeelding beschikbaar</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Titel en details container */}
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-1">{event.title}</h3>
              
              {/* Afstand indicator */}
              <div className="flex items-center gap-1 text-blue-500 mb-1">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">
                  {calculatedDistance !== undefined && typeof calculatedDistance === 'number' 
                    ? `${calculatedDistance.toFixed(1)} km van jouw huidige locatie` 
                    : 'Afstand onbekend'}
                </span>
              </div>
              
              {/* Datum en tijd - één regel */}
              <div className="flex items-center text-muted-foreground mb-1">
                <Calendar className="h-4 w-4 mr-1 flex-shrink-0" />
                <span className="text-sm">{formattedDate}</span>
              </div>
              
              {/* Countdown in groen voor bijna startende evenementen */}
              {isStartingSoon && (
                <div className="text-green-500 font-medium text-sm">
                  <span className="flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                    {countdownText}
                  </span>
                </div>
              )}
              
              {/* Andere statussen */}
              {isOngoing && (
                <div className="text-green-500 font-medium text-sm">
                  <span className="flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                    Event is nu bezig
                  </span>
                </div>
              )}
              
              {isExpired && (
                <div className="text-red-500 font-medium text-sm">
                  <span className="flex items-center">
                    <span className="w-2 h-2 bg-red-500 rounded-full mr-1.5"></span>
                    Event is verlopen
                  </span>
                </div>
              )}
              
              {!isOngoing && !isExpired && !isStartingSoon && (
                <div className="text-orange-500 font-medium text-sm">
                  {countdownText}
                </div>
              )}
            </div>
          </div>
        </Card>
      </Link>
    );
  }

  // De originele web lijstweergave (voor /web/ routes)
  return (
    <Link href={`/web/event/${event.id}`}>
      <Card className="overflow-hidden transition-all hover:shadow-md cursor-pointer event-card">
        <div className="flex flex-col md:flex-row">
          {/* Afbeelding links */}
          <div className="md:w-1/3 h-[180px] md:h-auto relative">
            {hasEventImage ? (
              <img 
                src={event.imageUrl || ''} 
                alt={event.title} 
                className="h-full w-full object-cover"
              />
            ) : (
              // Als er geen afbeelding is, toon een placeholder
              <div className="h-full w-full bg-gray-100 flex items-center justify-center">
                <div className="flex flex-col items-center justify-center text-gray-500">
                  <Image className="h-8 w-8 mb-2 opacity-50" />
                  <span className="text-xs text-center">Geen afbeelding beschikbaar</span>
                </div>
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
                          ? `${calculatedDistance.toFixed(1)} km van jouw huidige locatie` 
                          : 'Afstand onbekend'}
                      </span>
                    </div>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 pt-2 flex-1 flex flex-col">
              <div className="flex flex-col gap-2 mb-4">
                {isOngoing && (
                  <div className="bg-green-100 text-green-800 px-2 py-1 rounded-md text-xs font-medium inline-flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                    Event is nu bezig
                  </div>
                )}
                {isExpired && (
                  <div className="bg-red-100 text-red-800 px-2 py-1 rounded-md text-xs font-medium inline-flex items-center">
                    <span className="w-2 h-2 bg-red-500 rounded-full mr-1.5"></span>
                    Event is verlopen
                  </div>
                )}
                {!isOngoing && !isExpired && !isStartingSoon && (
                  <CountdownTimer startTime={event.startTime} />
                )}
                {isStartingSoon && (
                  <div className="bg-green-100 text-green-800 px-2 py-1 rounded-md text-xs font-medium inline-flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                    Start binnen 24 uur
                  </div>
                )}

                {event.isPaid && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Euro className="h-3 w-3" />
                    <span>{Number(event.price).toFixed(2)} EUR</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center text-sm text-muted-foreground mt-2">
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  <span>
                    {new Date(event.startTime).toLocaleDateString('nl-NL', {
                      day: 'numeric',
                      month: 'short'
                    })} om {new Date(event.startTime).toLocaleTimeString('nl-NL', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            </CardContent>
          </div>
        </div>
      </Card>
    </Link>
  );
}