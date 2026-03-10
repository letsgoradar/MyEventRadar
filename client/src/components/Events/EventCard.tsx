import React, { useState, useEffect } from 'react';
import type { EventInterface } from '@shared/schema';
import { MapPin, Calendar, Euro, Eye, Image, Clock, Bookmark, ExternalLink } from 'lucide-react';
import { isImageFailed, markImageFailed } from '@/lib/imageCache';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CategoryIcon, CATEGORY_COLORS, getCategoryColor } from '../CategoryIcon';
import { CountdownTimer } from './CountdownTimer';
import { Link } from 'wouter';
import { useLocation } from '@/hooks/useLocation';
import placeholderImage from '@/assets/placeholder-event.svg';
import { formatEventTimeRange, formatSmartEventDate, formatSmartEventDateLong } from '@/utils/date-utils';

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

function extractCityFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const parts = address.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    const cityMatch = lastPart.match(/\d{4}\s*[A-Z]{0,2}\s*(.+)/);
    if (cityMatch) return cityMatch[1].trim();
    const secondLast = parts[parts.length - 2];
    if (secondLast && !secondLast.match(/^\d/)) return secondLast;
  }
  return parts[0] || null;
}

interface EventCardProps {
  event: EventInterface;
  distance?: number;
  gridView?: boolean;
  onEventClick?: (event: EventInterface) => void;
  isHighlighted?: boolean;
  isPromoted?: boolean;
}

export default function EventCard({ event, distance, gridView = false, onEventClick, isHighlighted = false, isPromoted = false }: EventCardProps) {
  const [showStreetView, setShowStreetView] = useState(false);
  const [imageError, setImageError] = useState(() => isImageFailed(event.imageUrl));
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
  
  // Check of we op een App pagina met map view zijn (om events in kaartweergave te verbergen)
  const isAppMapView = window.location.pathname.includes('/app') && 
                        (window.location.search.includes('view=map') || 
                         document.getElementById('map-container') !== null);

  // Bepaal of er een evenement afbeelding beschikbaar is
  // Het imageUrl veld kan null of undefined zijn, dus we moeten controleren of het bestaat
  const hasEventImage = !!event.imageUrl;
  

  // Bepaal de juiste routering op basis van de huidige URL
  const isApp = window.location.pathname.includes('/app');
  const detailLink = isApp ? `/app/event/${event.id}` : `/web/event/${event.id}`;
  
  // Functie om een event op de kaart te tonen in plaats van direct naar detail te gaan
  const showEventOnMap = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Alleen toepassen voor web versie, niet voor App
    if (window.location.pathname.includes('/web') && window.location.pathname !== '/web/map') {
      // Navigeer naar kaartweergave als we niet al op de kaart zijn
      if (!window.location.pathname.includes('/web')) {
        window.location.href = '/web?viewType=map';
        return;
      }
      
      // Gebruik de globale navigatieEventToMap functie die we eerder hebben ingesteld
      if ((window as any).navigateToMapEvent) {
        (window as any).navigateToMapEvent(event);
        
        // Toon een tijdelijke informatiemelding
        const infoEl = document.createElement('div');
        infoEl.className = 'fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-primary text-white px-4 py-2 rounded-full shadow-lg z-50';
        infoEl.textContent = 'Klik op "Bekijk details" voor alle informatie';
        document.body.appendChild(infoEl);
        
        // Verwijder de melding na 3 seconden
        setTimeout(() => {
          infoEl.classList.add('opacity-0', 'transition-opacity');
          setTimeout(() => {
            document.body.removeChild(infoEl);
          }, 300);
        }, 3000);
        
        return;
      }
    }
    
    // Fallback: navigeer direct naar detail pagina
    window.location.href = detailLink;
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (onEventClick) {
      e.preventDefault();
      onEventClick(event);
    } else {
      // Fallback voor als er geen onEventClick handler is
      showEventOnMap(e);
    }
  };

  if (gridView) {
    // Voor grid view, gebruik altijd div wrapper met click handler
    const handleClick = (e: React.MouseEvent) => {
      if (onEventClick) {
        e.preventDefault();
        onEventClick(event);
      } else {
        showEventOnMap(e);
      }
    };
    
    const cityName = extractCityFromAddress(event.address);
    const showPlaceholder = !hasEventImage || imageError;
    
    return (
      <div onClick={handleClick}>
        <Card className={`overflow-hidden transition-all hover:shadow-md cursor-pointer h-full flex flex-col event-card ${isPromoted ? 'ring-2 ring-amber-400 shadow-amber-100' : ''}`}>
          {/* Afbeelding bovenaan met overlay voor views en status */}
          <div className="relative h-48 overflow-hidden">
            {isPromoted && (
              <div className="absolute top-2 left-2 z-30 bg-amber-500 text-white px-2 py-0.5 rounded-full text-xs font-semibold">
                Gepromoot
              </div>
            )}
            {showPlaceholder ? (
              <img 
                src={placeholderImage} 
                alt={event.title} 
                className="h-full w-full object-cover bg-gray-100"
              />
            ) : (
              <img 
                src={event.imageUrl || ''} 
                alt={event.title} 
                className="h-full w-full object-cover"
                onError={() => { markImageFailed(event.imageUrl, event.id); setImageError(true); }}
                loading="lazy"
              />
            )}
            
            {/* Links onder: views + event status overlay */}
            <div className="absolute bottom-2 left-2 flex items-center gap-2 z-20">
              {/* Views counter - altijd zichtbaar */}
              <div className="bg-black/60 px-2 py-1 rounded-full flex items-center text-xs text-white">
                <Eye className="h-3 w-3 mr-1" />
                <span>{event.detailViews || 0}</span>
              </div>
              
              {/* Event status badge */}
              {isOngoing && (
                <div className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium inline-flex items-center">
                  <span className="w-1.5 h-1.5 bg-white rounded-full mr-1 animate-pulse"></span>
                  Nu bezig
                </div>
              )}
              {isExpired && (
                <div className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium inline-flex items-center">
                  Verlopen
                </div>
              )}
            </div>
          </div>
          
          {/* Content voor de kaart */}
          <CardHeader className="p-4 pb-2 flex-1">
            <CardTitle className="text-lg font-bold">
              {event.title}
            </CardTitle>
            
            {/* Locatie: Plaatsnaam + km */}
            <div className="flex items-center gap-1.5 mt-1 text-gray-500 text-sm">
              <MapPin className="flex-shrink-0 h-4 w-4" />
              <span>
                {cityName && `${cityName} • `}
                {calculatedDistance !== undefined && typeof calculatedDistance === 'number' 
                  ? `${calculatedDistance.toFixed(1)} km` 
                  : ''}
              </span>
            </div>
          </CardHeader>
          
          <CardContent className="p-4 pt-0">
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <div className="flex items-center flex-wrap gap-1">
                <Calendar className="h-4 w-4 mr-1" />
                <span>
                  {formatSmartEventDate(event.startTime, event.endTime)}{(() => {
                    const timeRange = formatEventTimeRange(event.startTime, event.endTime);
                    return timeRange ? ` ${timeRange}` : '';
                  })()}
                  {/* Time-to-event indicator achter de datum */}
                  {!isOngoing && !isExpired && (() => {
                    const daysUntil = Math.ceil((startTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const hoursUntil = Math.floor((startTime.getTime() - now.getTime()) / (1000 * 60 * 60));
                    if (hoursUntil < 24) {
                      return <span className="text-green-600 ml-1">(over {hoursUntil}u)</span>;
                    } else if (daysUntil === 1) {
                      return <span className="text-muted-foreground ml-1">(morgen)</span>;
                    } else {
                      return <span className="text-muted-foreground ml-1">(over {daysUntil} dagen)</span>;
                    }
                  })()}
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
      </div>
    );
  }

  // De nieuwe mobiele App lijst weergave
  if (window.location.pathname.includes('/app')) {
    // Bij kaartweergave, toon geen event cards
    if (isAppMapView || document.querySelector('.map-view-content')) {
      return null;
    }
    
    // Bereken of het evenement binnen 24 uur begint
    const now = new Date();
    const startTime = new Date(event.startTime);
    const isStartingSoon = !isOngoing && !isExpired && 
                          (startTime.getTime() - now.getTime()) < 24 * 60 * 60 * 1000;
    
    // Formateer de datum als "vrijdag 18 april vanaf 16:23" of "vrijdag 18 april 16:23 - 18:00"
    const timeRange = formatEventTimeRange(event.startTime, event.endTime);
    // Slimme datumweergave voor app - gebruikt gecentraliseerde functie
    const smartDate = formatSmartEventDateLong(event.startTime, event.endTime);
    const formattedDate = smartDate.startsWith('Nu t/m') ? smartDate : smartDate + (timeRange ? ` ${timeRange}` : '');
    
    // Bereken een ruwe schatting van de resterende tijd (voor countdowntekst)
    const timeUntilStart = startTime.getTime() - now.getTime();
    const hoursUntilStart = Math.floor(timeUntilStart / (1000 * 60 * 60));
    let countdownText = `over ongeveer ${hoursUntilStart} uur`;
    if (hoursUntilStart < 1) {
      const minutesUntilStart = Math.floor(timeUntilStart / (1000 * 60));
      countdownText = `over ongeveer ${minutesUntilStart} minuten`;
    }
    
    // Voor app interface, gebruik altijd div wrapper met click handler
    const handleAppClick = (e: React.MouseEvent) => {
      if (onEventClick) {
        e.preventDefault();
        onEventClick(event);
      } else {
        showEventOnMap(e);
      }
    };
    
    const appCityName = extractCityFromAddress(event.address);
    const appShowPlaceholder = !hasEventImage || imageError;
    
    return (
      <div onClick={handleAppClick}>
        <Card className={`overflow-hidden mb-4 transition-all hover:shadow-md cursor-pointer event-card ${isPromoted ? 'ring-2 ring-amber-400 shadow-amber-100' : ''}`}>
          <div className="p-0">
            {/* Afbeelding container bovenaan */}
            <div className="w-full h-48 relative bg-gray-100">
              {isPromoted && (
                <div className="absolute top-2 left-2 z-30 bg-amber-500 text-white px-2 py-0.5 rounded-full text-xs font-semibold">
                  Gepromoot
                </div>
              )}
              {appShowPlaceholder ? (
                <img 
                  src={placeholderImage} 
                  alt={event.title} 
                  className="h-full w-full object-cover"
                />
              ) : (
                <img 
                  src={event.imageUrl || ''} 
                  alt={event.title} 
                  className="h-full w-full object-cover"
                  onError={() => { markImageFailed(event.imageUrl, event.id); setImageError(true); }}
                  loading="lazy"
                />
              )}
              
              {/* Links onder: views + event status overlay */}
              <div className="absolute bottom-2 left-2 flex items-center gap-2 z-20">
                {/* Views counter - altijd zichtbaar */}
                <div className="bg-black/60 px-2 py-1 rounded-full flex items-center text-xs text-white">
                  <Eye className="h-3 w-3 mr-1" />
                  <span>{event.detailViews || 0}</span>
                </div>
                
                {/* Event status badge */}
                {isOngoing && (
                  <div className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium inline-flex items-center">
                    <span className="w-1.5 h-1.5 bg-white rounded-full mr-1 animate-pulse"></span>
                    Nu bezig
                  </div>
                )}
                {isExpired && (
                  <div className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium inline-flex items-center">
                    Verlopen
                  </div>
                )}
              </div>
            </div>
            
            {/* Titel en details container */}
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-1">{event.title}</h3>
              
              {/* Locatie: Plaatsnaam + km */}
              <div className="flex items-center gap-1 text-blue-500 mb-1">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">
                  {appCityName && `${appCityName} • `}
                  {calculatedDistance !== undefined && typeof calculatedDistance === 'number' 
                    ? `${calculatedDistance.toFixed(1)} km` 
                    : ''}
                </span>
              </div>
              
              {/* Datum en tijd met time-to-event indicator */}
              <div className="flex items-center text-muted-foreground mb-1 flex-wrap gap-1">
                <Calendar className="h-4 w-4 mr-1 flex-shrink-0" />
                <span className="text-sm">
                  {formattedDate}
                  {/* Time-to-event indicator achter de datum */}
                  {!isOngoing && !isExpired && (() => {
                    const daysUntil = Math.ceil((startTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const hoursUntil = Math.floor((startTime.getTime() - now.getTime()) / (1000 * 60 * 60));
                    if (hoursUntil < 24) {
                      return <span className="text-green-600 ml-1">(over {hoursUntil}u)</span>;
                    } else if (daysUntil === 1) {
                      return <span className="text-muted-foreground ml-1">(morgen)</span>;
                    } else {
                      return <span className="text-muted-foreground ml-1">(over {daysUntil} dagen)</span>;
                    }
                  })()}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // De originele web lijstweergave (voor /web/ routes)
  const listCityName = extractCityFromAddress(event.address);
  const listShowPlaceholder = !hasEventImage || imageError;
  
  return (
    <Link href={detailLink} onClick={window.location.pathname.includes('/web') ? showEventOnMap : undefined}>
      <Card className={`overflow-hidden transition-all hover:shadow-md cursor-pointer event-card ${isPromoted ? 'ring-2 ring-amber-400 shadow-amber-100' : ''}`}>
        <div className="flex flex-col md:flex-row">
          {/* Afbeelding links */}
          <div className="md:w-1/3 h-[180px] md:h-auto relative">
            {isPromoted && (
              <div className="absolute top-2 left-2 z-30 bg-amber-500 text-white px-2 py-0.5 rounded-full text-xs font-semibold">
                Gepromoot
              </div>
            )}
            {listShowPlaceholder ? (
              <img 
                src={placeholderImage} 
                alt={event.title} 
                className="h-full w-full object-cover bg-gray-100"
              />
            ) : (
              <img 
                src={event.imageUrl || ''} 
                alt={event.title} 
                className="h-full w-full object-cover"
                onError={() => { markImageFailed(event.imageUrl, event.id); setImageError(true); }}
                loading="lazy"
              />
            )}
            
            {/* Links onder: views + event status overlay */}
            <div className="absolute bottom-2 left-2 flex items-center gap-2 z-20">
              {/* Views counter - altijd zichtbaar */}
              <div className="bg-black/60 px-2 py-1 rounded-full flex items-center text-xs text-white">
                <Eye className="h-3 w-3 mr-1" />
                <span>{event.detailViews || 0}</span>
              </div>
              
              {/* Event status badge */}
              {isOngoing && (
                <div className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium inline-flex items-center">
                  <span className="w-1.5 h-1.5 bg-white rounded-full mr-1 animate-pulse"></span>
                  Nu bezig
                </div>
              )}
              {isExpired && (
                <div className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium inline-flex items-center">
                  Verlopen
                </div>
              )}
            </div>
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
                        {listCityName && `${listCityName} • `}
                        {calculatedDistance !== undefined && typeof calculatedDistance === 'number' 
                          ? `${calculatedDistance.toFixed(1)} km` 
                          : ''}
                      </span>
                    </div>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 pt-2 flex-1 flex flex-col">
              <div className="flex flex-col gap-2 mb-4">
                {!isOngoing && !isExpired && (
                  <CountdownTimer 
                    targetDate={startTime}
                    showHours={isStartingSoon} 
                    showMinutesSeconds={isStartingSoon && (startTime.getTime() - now.getTime()) < 60 * 60 * 1000}
                    pulsate={isStartingSoon && (startTime.getTime() - now.getTime()) < 60 * 60 * 1000}
                  />
                )}

                {event.isPaid && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Euro className="h-3 w-3" />
                    <span>{Number(event.price).toFixed(2)} EUR</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center text-sm text-muted-foreground mt-2">
                <div className="flex items-center flex-wrap gap-1">
                  <Calendar className="h-4 w-4 mr-1" />
                  <span>
                    {formatSmartEventDate(event.startTime, event.endTime)}{(() => {
                      const timeRange = formatEventTimeRange(event.startTime, event.endTime);
                      return timeRange ? ` ${timeRange}` : '';
                    })()}
                    {/* Time-to-event indicator achter de datum */}
                    {!isOngoing && !isExpired && (() => {
                      const daysUntil = Math.ceil((startTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                      const hoursUntil = Math.floor((startTime.getTime() - now.getTime()) / (1000 * 60 * 60));
                      if (hoursUntil < 24) {
                        return <span className="text-green-600 ml-1">(over {hoursUntil}u)</span>;
                      } else if (daysUntil === 1) {
                        return <span className="text-muted-foreground ml-1">(morgen)</span>;
                      } else {
                        return <span className="text-muted-foreground ml-1">(over {daysUntil} dagen)</span>;
                      }
                    })()}
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