import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import {
  Satellite,
  X as CloseIcon,
  MapPin,
  Euro,
  Clock,
  Search
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import L from 'leaflet';
import React, { useState, useEffect, useRef } from 'react';
import type { Event } from "@shared/schema";
import './leaflet-fix.css';
import { format, differenceInDays } from "date-fns";
import { nl } from "date-fns/locale";


function MapBoundsControl({ events }: { events: Event[] }) {
  const map = useMap();

  useEffect(() => {
    if (events.length > 0) {
      const bounds = L.latLngBounds(events.map(e => [Number(e.latitude), Number(e.longitude)]));
      map.fitBounds(bounds, {
        padding: [50, 50],
        duration: 1.5,
        maxZoom: 15
      });
    }
  }, [events, map]);

  return null;
}

function UserLocationMarker({ position }: { position: [number, number] }) {
  return position ? (
    <Marker 
      position={position}
      icon={L.divIcon({
        className: 'custom-icon',
        html: `<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      })}
    >
      <Popup>
        <div className="text-sm font-medium">Mijn locatie</div>
      </Popup>
    </Marker>
  ) : null;
}

const createEventIcon = (category: string) => {
  return L.divIcon({
    className: 'custom-icon',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    html: `<div style="width: 12px; height: 12px; border-radius: 50%; border: 1px solid white; box-shadow: 0 1px 2px rgba(0,0,0,0.2); background-color: #666666;"></div>`
  });
};

export default function MapView({ filters, onFilterChange }: MapViewProps) {
  const [userLocation, setUserLocation] = useState<[number, number]>([51.7656, 5.5314]);
  const [isSatelliteView, setIsSatelliteView] = useState(false);
  const [mapKey, setMapKey] = useState(0);

  // Get active filters for display
  const activeFilters = [
    filters.searchQuery && { type: 'search', label: `Zoeken: "${filters.searchQuery}"` },
    filters.showFreeOnly && { type: 'price', label: 'Alleen gratis' },
    filters.maxPrice && { type: 'price', label: `Max €${filters.maxPrice}` },
    filters.maxDaysToEvent !== 14 && { 
      type: 'time', 
      label: filters.maxDaysToEvent === 999 ? 'Alle events' : `Binnen ${filters.maxDaysToEvent} dagen` 
    },
    filters.distanceRadius && { 
      type: 'distance', 
      label: `${filters.distanceRadius}km radius` 
    }
  ].filter(Boolean);

  // Fetch events
  const { data: events = [] } = useQuery({
    queryKey: ["/api/events/nearby", filters, userLocation],
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: userLocation[0].toString(),
        lng: userLocation[1].toString(),
        radius: filters.distanceRadius.toString(),
      });

      const response = await fetch(`/api/events/nearby?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      return response.json();
    },
  });

  // Filter events based on current filters
  const filteredEvents = events?.filter(event => {
    // Price filter
    if (filters.showFreeOnly && event.isPaid) return false;
    if (filters.maxPrice !== null && event.price > filters.maxPrice) return false;

    // Time filter
    const eventDate = new Date(event.startTime);
    const daysUntilEvent = differenceInDays(eventDate, new Date());
    if (daysUntilEvent < 0) return false; // Past events
    if (filters.maxDaysToEvent !== 999 && daysUntilEvent > filters.maxDaysToEvent) return false;

    // Search filter
    if (filters.searchQuery) {
      const searchLower = filters.searchQuery.toLowerCase();
      return (
        event.title.toLowerCase().includes(searchLower) ||
        event.description?.toLowerCase().includes(searchLower)
      );
    }

    return true;
  }) || [];

  // Update filter counts
  useEffect(() => {
    const totalEvents = filteredEvents.length;
    if (onFilterChange) {
      onFilterChange({
        ...filters,
        totalMatchingEvents: totalEvents
      });
    }
  }, [filteredEvents, onFilterChange, filters]);

  const tileUrl = isSatelliteView
    ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  const tileConfig = isSatelliteView
    ? { subdomains: [] }
    : { subdomains: 'abcd' };

  return (
    <div className="h-full relative">
      {/* Map Controls - Left side */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
        <Button
          variant="outline"
          size="icon"
          className="bg-white/90 hover:bg-white h-8 w-8"
          onClick={() => setIsSatelliteView(!isSatelliteView)}
        >
          <Satellite className={`h-4 w-4 ${isSatelliteView ? 'text-primary' : 'text-muted-foreground'}`} />
        </Button>
      </div>

      {/* Active Filters Display - Right side */}
      {activeFilters.length > 0 && (
        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-1.5 max-w-[200px]">
          {activeFilters.map((filter, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="bg-white/90 px-2 py-1 flex items-center justify-between gap-2 text-sm"
            >
              <span className="truncate">{filter.label}</span>
              <button
                className="opacity-70 hover:opacity-100"
                onClick={() => {
                  if (!filter) return;
                  const updates: any = {};
                  switch (filter.type) {
                    case 'search':
                      updates.searchQuery = '';
                      break;
                    case 'price':
                      updates.showFreeOnly = false;
                      updates.maxPrice = null;
                      break;
                    case 'time':
                      updates.maxDaysToEvent = 14;
                      break;
                    case 'distance':
                      updates.distanceRadius = 5;
                      break;
                  }
                  onFilterChange({ ...filters, ...updates });
                }}
              >
                <CloseIcon className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Map Container */}
      <MapContainer
        key={mapKey}
        center={userLocation}
        zoom={13}
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer url={tileUrl} {...tileConfig} />
        <MapBoundsControl events={filteredEvents} />
        <UserLocationMarker position={userLocation} />

        {/* Event Markers */}
        {filteredEvents.map(event => {
          const lat = Number(event.latitude);
          const lng = Number(event.longitude);

          if (isNaN(lat) || isNaN(lng)) return null;

          return (
            <Marker
              key={event.id}
              position={[lat, lng]}
              icon={createEventIcon(event.category)}
            >
              <Popup className="event-popup" maxWidth={300}>
                <div className="text-sm pb-1">
                  <div className="event-card-map">
                    <div className="font-semibold mb-1 truncate">
                      {event.title}
                    </div>
                    {event.description && (
                      <div className="mb-2 text-xs text-muted-foreground">
                        {event.description.substring(0, 80)}
                        {event.description.length > 80 ? '...' : ''}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <Clock className="h-3 w-3" />
                      <span>{format(new Date(event.startTime), 'PPP', { locale: nl })}</span>
                    </div>
                    <Link
                      to={`/event/${event.id}`}
                      className="text-primary hover:text-primary/80 underline text-xs"
                    >
                      Details bekijken
                    </Link>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

interface FilterProps {
  searchQuery: string;
  fromDate: Date | null;
  toDate: Date | null;
  showPaidEvents: boolean;
  maxPrice: number | null;
  useDistanceFilter: boolean;
  distanceRadius: number;
  showFreeOnly: boolean;
  maxDaysToEvent: number;
  totalMatchingEvents?: number;
}

interface MapViewProps {
  filters: FilterProps;
  onFilterChange?: (filters: FilterProps) => void;
}