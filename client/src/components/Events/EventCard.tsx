import React, { useState, useEffect } from 'react';
import type { EventInterface } from '@shared/schema';
import { MapPin, Calendar, Euro, Eye, EyeOff, Heart } from 'lucide-react';
import { isImageFailed, markImageFailed } from '@/lib/imageCache';

import { Card, CardContent, CardHeader, CardDescription, CardTitle } from '@/components/ui/card';
import { CountdownTimer } from './CountdownTimer';
import { Link } from 'wouter';
import { useLocation } from '@/hooks/useLocation';
import placeholderImage from '@/assets/placeholder-event.svg';
import { formatEventTimeRange, formatSmartEventDate, formatSmartEventDateLong } from '@/utils/date-utils';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

function extractCityFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;

  // Strip "naar " prefix (e.g. "naar Beginnings" → skip, use other method)
  const cleaned = address.replace(/^naar\s+/i, '').trim();

  // Split by comma
  const parts = cleaned.split(',').map(p => p.trim()).filter(Boolean);

  if (parts.length === 0) return null;

  // Work from the end to find the city segment
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    // Match Dutch postcode pattern: "1234AB Plaatsnaam" or "1234 AB Plaatsnaam"
    const postcodeCity = part.match(/^\d{4}\s*[A-Z]{2}\s+(.+)/i);
    if (postcodeCity) return postcodeCity[1].trim();

    // If last segment looks like a city (only letters, spaces, hyphens – no digits, not too long)
    if (i === parts.length - 1) {
      if (/^[A-Za-zÀ-ÿ\s\-']+$/.test(part) && part.length <= 40 && parts.length >= 2) {
        return part;
      }
    }
  }

  // If only 1 segment: check it doesn't look like a street (contains number at start)
  if (parts.length === 1) {
    const single = parts[0];
    // Skip addresses that look like streets (start with street-like text + number)
    if (/^\d/.test(single)) return null;
    // Skip if it looks like a postcode-only
    if (/^\d{4}\s*[A-Z]{2}$/.test(single)) return null;
    return single;
  }

  return parts[parts.length - 1] || null;
}

function formatDateBadge(startTime: string | Date, endTime?: string | Date | null): string {
  const now = new Date();
  const start = new Date(startTime);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 86400000);
  const dayAfterStart = new Date(todayStart.getTime() + 2 * 86400000);
  const end = endTime ? new Date(endTime) : null;

  if (end && end < now) return 'Verlopen';
  if (start <= now && (!end || end >= now)) return 'Nu bezig';
  if (start >= todayStart && start < tomorrowStart) return 'Vandaag';
  if (start >= tomorrowStart && start < dayAfterStart) return 'Morgen';

  return start.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
}

interface EventCardProps {
  event: EventInterface;
  distance?: number;
  gridView?: boolean;
  onEventClick?: (event: EventInterface) => void;
  isHighlighted?: boolean;
  isPromoted?: boolean;
  isHidden?: boolean;
  onHideToggle?: (eventId: number) => void;
}

export default function EventCard({ event, distance, gridView = false, onEventClick, isHighlighted = false, isPromoted = false, isHidden = false, onHideToggle }: EventCardProps) {
  const [imageError, setImageError] = useState(() => isImageFailed(event.imageUrl));
  const { location } = useLocation();
  const [calculatedDistance, setCalculatedDistance] = useState<number | undefined>(distance);
  const { user } = useAuth();
  const { toast } = useToast();

  const now = new Date();
  const startTime = new Date(event.startTime);
  const endTime = event.endTime ? new Date(event.endTime) : new Date(startTime.getTime() + 2 * 60 * 60 * 1000);
  const isExpired = endTime < now;
  const isOngoing = startTime <= now && endTime >= now;
  const isStartingSoon = !isOngoing && !isExpired &&
    (startTime.getTime() - now.getTime()) < 24 * 60 * 60 * 1000;

  const isApp = window.location.pathname.includes('/app');
  const isAppMapView = window.location.pathname.includes('/app') &&
    (window.location.search.includes('view=map') ||
      document.getElementById('map-container') !== null);
  const detailLink = isApp ? `/app/event/${event.id}` : `/web/event/${event.id}`;
  const hasEventImage = !!event.imageUrl;

  useEffect(() => {
    if (distance !== undefined) {
      setCalculatedDistance(distance);
    } else if (location) {
      const dist = calculateDistance(
        location.lat, location.lng,
        Number(event.latitude), Number(event.longitude)
      );
      setCalculatedDistance(dist);
    }
  }, [location, distance, event.latitude, event.longitude]);

  // Favorites
  const { data: favorites = [] } = useQuery<any[]>({
    queryKey: ['/api/events/favorites'],
    enabled: !!user,
  });
  const isFavorited = Array.isArray(favorites) && favorites.some((f: any) => f.id === event.id);

  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      if (isFavorited) {
        const res = await fetch(`/api/favorite/${event.id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to remove favorite');
      } else {
        const res = await fetch('/api/favorite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ eventId: event.id }),
        });
        if (!res.ok) throw new Error('Failed to add favorite');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events/favorites'] });
      queryClient.invalidateQueries({ queryKey: [`/api/favorites/${user?.id}`] });
    },
  });

  const handleHeartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user) {
      toast({ title: 'Log in om evenementen op te slaan', description: 'Maak een account aan of log in.' });
      return;
    }
    toggleFavoriteMutation.mutate();
  };

  const showEventOnMap = (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.location.pathname.includes('/web') && window.location.pathname !== '/web/map') {
      if ((window as any).navigateToMapEvent) {
        (window as any).navigateToMapEvent(event);
        const infoEl = document.createElement('div');
        infoEl.className = 'fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-primary text-white px-4 py-2 rounded-full shadow-lg z-50';
        infoEl.textContent = 'Klik op "Bekijk details" voor alle informatie';
        document.body.appendChild(infoEl);
        setTimeout(() => {
          infoEl.classList.add('opacity-0', 'transition-opacity');
          setTimeout(() => { document.body.removeChild(infoEl); }, 300);
        }, 3000);
        return;
      }
    }
    window.location.href = detailLink;
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (onEventClick) { e.preventDefault(); onEventClick(event); }
    else showEventOnMap(e);
  };

  // Overlay buttons: heart + hide (used in all card variants)
  const OverlayButtons = () => (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
      <button
        onClick={handleHeartClick}
        className="bg-black/40 hover:bg-black/60 text-white p-1.5 rounded-full transition-colors"
        title={isFavorited ? 'Verwijder uit opgeslagen' : 'Opslaan'}
      >
        <Heart className={`h-4 w-4 ${isFavorited ? 'fill-red-500 stroke-red-500' : 'fill-transparent stroke-white'}`} />
      </button>
      {onHideToggle && (
        <button
          onClick={(e) => { e.stopPropagation(); onHideToggle(event.id); }}
          className="bg-black/40 hover:bg-black/60 text-white p-1.5 rounded-full transition-colors"
          title={isHidden ? 'Evenement tonen' : 'Evenement verbergen'}
        >
          {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
    </div>
  );

  // Date badge for image overlay (bottom-left)
  const dateBadgeText = formatDateBadge(event.startTime, event.endTime);
  const dateBadgeColor = dateBadgeText === 'Nu bezig' ? 'bg-green-500' :
    dateBadgeText === 'Verlopen' ? 'bg-red-500' :
    dateBadgeText === 'Vandaag' ? 'bg-primary' :
    dateBadgeText === 'Morgen' ? 'bg-[#1A2B3C]' : 'bg-[#1A2B3C]/80';

  // ── GRID VIEW (web overview) ────────────────────────────────────────────────
  if (gridView) {
    const handleClick = (e: React.MouseEvent) => {
      if (onEventClick) { e.preventDefault(); onEventClick(event); }
      else showEventOnMap(e);
    };
    const cityName = extractCityFromAddress(event.address);
    const showPlaceholder = !hasEventImage || imageError;

    return (
      <div onClick={handleClick}>
        <Card className={`overflow-hidden transition-all hover:shadow-md cursor-pointer h-full flex flex-col event-card ${isPromoted ? 'ring-2 ring-amber-400 shadow-amber-100' : ''}`}>
          <div className="relative h-48 overflow-hidden">
            {isPromoted && (
              <div className="absolute top-2 left-2 z-10 bg-amber-500 text-white px-2 py-0.5 rounded-full text-xs font-semibold">
                Gepromoot
              </div>
            )}

            <OverlayButtons />

            {showPlaceholder ? (
              <img src={placeholderImage} alt={event.title} className="h-full w-full object-cover bg-gray-100" />
            ) : (
              <img
                src={event.imageUrl || ''}
                alt={event.title}
                className="h-full w-full object-cover"
                onError={() => { markImageFailed(event.imageUrl, event.id); setImageError(true); }}
                loading="lazy"
              />
            )}

            {/* Date badge bottom-left */}
            <div className="absolute bottom-2 left-2 z-10 flex items-center gap-2">
              <span className={`${dateBadgeColor} text-white px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1`}>
                {dateBadgeText === 'Nu bezig' && <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
                {dateBadgeText}
              </span>
            </div>
          </div>

          <CardHeader className="p-4 pb-2 flex-1">
            <CardTitle className="text-lg font-bold">{event.title}</CardTitle>
            <div className="flex items-center gap-1.5 mt-1 text-gray-500 text-sm">
              <MapPin className="flex-shrink-0 h-4 w-4" />
              <span>
                {cityName || ''}
                {cityName && calculatedDistance !== undefined ? ' • ' : ''}
                {calculatedDistance !== undefined ? `${calculatedDistance.toFixed(1)} km` : ''}
              </span>
            </div>
          </CardHeader>

          <CardContent className="p-4 pt-0">
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <div className="flex items-center flex-wrap gap-1">
                <Calendar className="h-4 w-4 mr-1" />
                <span>
                  {formatSmartEventDate(event.startTime, event.endTime)}{(() => {
                    const tr = formatEventTimeRange(event.startTime, event.endTime);
                    return tr ? ` ${tr}` : '';
                  })()}
                  {!isOngoing && !isExpired && (() => {
                    const hoursUntil = Math.floor((startTime.getTime() - now.getTime()) / (1000 * 60 * 60));
                    const daysUntil = Math.ceil((startTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    if (hoursUntil < 24) return <span className="text-green-600 ml-1">(over {hoursUntil}u)</span>;
                    if (daysUntil === 1) return <span className="text-muted-foreground ml-1">(morgen)</span>;
                    return <span className="text-muted-foreground ml-1">(over {daysUntil} dagen)</span>;
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

  // ── APP LIST VIEW ───────────────────────────────────────────────────────────
  if (isApp) {
    if (isAppMapView || document.querySelector('.map-view-content')) return null;

    const timeRange = formatEventTimeRange(event.startTime, event.endTime);
    const smartDate = formatSmartEventDateLong(event.startTime, event.endTime);
    const formattedDate = smartDate.startsWith('Nu t/m') ? smartDate : smartDate + (timeRange ? ` ${timeRange}` : '');

    const handleAppClick = (e: React.MouseEvent) => {
      if (onEventClick) { e.preventDefault(); onEventClick(event); }
      else showEventOnMap(e);
    };
    const appCityName = extractCityFromAddress(event.address);
    const appShowPlaceholder = !hasEventImage || imageError;

    return (
      <div onClick={handleAppClick}>
        <Card className={`overflow-hidden mb-4 transition-all hover:shadow-md cursor-pointer event-card ${isPromoted ? 'ring-2 ring-amber-400 shadow-amber-100' : ''}`}>
          <div className="p-0">
            <div className="w-full h-48 relative bg-gray-100 overflow-hidden">
              {isPromoted && (
                <div className="absolute top-2 left-2 z-10 bg-amber-500 text-white px-2 py-0.5 rounded-full text-xs font-semibold">
                  Gepromoot
                </div>
              )}

              {/* Date badge top-left (like in app screenshot) */}
              {!isPromoted && (
                <div className="absolute top-2 left-2 z-10">
                  <span className={`${dateBadgeColor} text-white px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1`}>
                    {dateBadgeText === 'Nu bezig' && <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
                    {dateBadgeText}
                  </span>
                </div>
              )}

              <OverlayButtons />

              {appShowPlaceholder ? (
                <img src={placeholderImage} alt={event.title} className="h-full w-full object-cover" />
              ) : (
                <img
                  src={event.imageUrl || ''}
                  alt={event.title}
                  className="h-full w-full object-cover"
                  onError={() => { markImageFailed(event.imageUrl, event.id); setImageError(true); }}
                  loading="lazy"
                />
              )}
            </div>

            <div className="p-4">
              <h3 className="text-lg font-semibold mb-1">{event.title}</h3>

              <div className="flex items-center gap-1 text-blue-500 mb-1">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">
                  {appCityName || ''}
                  {appCityName && calculatedDistance !== undefined ? ' • ' : ''}
                  {calculatedDistance !== undefined ? `${calculatedDistance.toFixed(1)} km` : ''}
                </span>
              </div>

              <div className="flex items-center text-muted-foreground mb-1 flex-wrap gap-1">
                <Calendar className="h-4 w-4 mr-1 flex-shrink-0" />
                <span className="text-sm">
                  {formattedDate}
                  {!isOngoing && !isExpired && (() => {
                    const hoursUntil = Math.floor((startTime.getTime() - now.getTime()) / (1000 * 60 * 60));
                    const daysUntil = Math.ceil((startTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    if (hoursUntil < 24) return <span className="text-green-600 ml-1">(over {hoursUntil}u)</span>;
                    if (daysUntil === 1) return <span className="text-muted-foreground ml-1">(morgen)</span>;
                    return <span className="text-muted-foreground ml-1">(over {daysUntil} dagen)</span>;
                  })()}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ── WEB LIST VIEW ───────────────────────────────────────────────────────────
  const listCityName = extractCityFromAddress(event.address);
  const listShowPlaceholder = !hasEventImage || imageError;

  return (
    <Link href={detailLink} onClick={window.location.pathname.includes('/web') ? showEventOnMap : undefined}>
      <Card className={`overflow-hidden transition-all hover:shadow-md cursor-pointer event-card ${isPromoted ? 'ring-2 ring-amber-400 shadow-amber-100' : ''}`}>
        <div className="flex flex-col md:flex-row">
          <div className="md:w-1/3 h-[180px] md:h-auto relative overflow-hidden">
            {isPromoted && (
              <div className="absolute top-2 left-2 z-10 bg-amber-500 text-white px-2 py-0.5 rounded-full text-xs font-semibold">
                Gepromoot
              </div>
            )}

            <OverlayButtons />

            {listShowPlaceholder ? (
              <img src={placeholderImage} alt={event.title} className="h-full w-full object-cover bg-gray-100" />
            ) : (
              <img
                src={event.imageUrl || ''}
                alt={event.title}
                className="h-full w-full object-cover"
                onError={() => { markImageFailed(event.imageUrl, event.id); setImageError(true); }}
                loading="lazy"
              />
            )}

            {/* Date badge bottom-left */}
            <div className="absolute bottom-2 left-2 z-10 flex items-center gap-2">
              <span className={`${dateBadgeColor} text-white px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1`}>
                {dateBadgeText === 'Nu bezig' && <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
                {dateBadgeText}
              </span>
            </div>
          </div>

          <div className="md:w-2/3 flex flex-col">
            <CardHeader className="p-4 pb-0">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg font-bold line-clamp-1">{event.title}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1 text-gray-500">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span className="text-xs">
                        {listCityName || ''}
                        {listCityName && calculatedDistance !== undefined ? ' • ' : ''}
                        {calculatedDistance !== undefined ? `${calculatedDistance.toFixed(1)} km` : ''}
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
                      const tr = formatEventTimeRange(event.startTime, event.endTime);
                      return tr ? ` ${tr}` : '';
                    })()}
                    {!isOngoing && !isExpired && (() => {
                      const hoursUntil = Math.floor((startTime.getTime() - now.getTime()) / (1000 * 60 * 60));
                      const daysUntil = Math.ceil((startTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                      if (hoursUntil < 24) return <span className="text-green-600 ml-1">(over {hoursUntil}u)</span>;
                      if (daysUntil === 1) return <span className="text-muted-foreground ml-1">(morgen)</span>;
                      return <span className="text-muted-foreground ml-1">(over {daysUntil} dagen)</span>;
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
