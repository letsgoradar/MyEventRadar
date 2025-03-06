import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import {
  Satellite,
  ChevronDown,
  Tag as CategoryIcon,
  Euro,
  Clock,
  Search
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Link } from "wouter";
import L from 'leaflet';
import React, { useState, useEffect, useRef } from 'react';
import type { Event } from "@shared/schema";
import './leaflet-fix.css';
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { nl } from "date-fns/locale";
import { Slider } from "@/components/ui/slider";

// Add pulse animation CSS
const pulseAnimation = `
  @keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    70% { transform: scale(2); opacity: 0; }
    100% { transform: scale(1); opacity: 0; }
  }
`;

const style = document.createElement('style');
style.textContent = pulseAnimation;
document.head.appendChild(style);

const categoryColors = {
  'all': '#666666',  // gray for "all" category
  'festival': '#FF9800',
  'sports': '#2196F3',
  'food': '#4CAF50',
  'culture': '#9C27B0',
  'market': '#FF5722',
  'education': '#607D8B',
  'music': '#E91E63',
  'technology': '#00BCD4',
  'gaming': '#8BC34A',
  'health': '#FFEB3B',
  'nature': '#795548',
};

const getCategoryColor = (category: string): string => {
  const normalizedCategory = category.toLowerCase();
  return categoryColors[normalizedCategory as keyof typeof categoryColors] || '#9E9E9E';
};

const createEventIcon = (category: string) => {
  const color = getCategoryColor(category);
  return L.divIcon({
    className: 'custom-icon',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    html: `<div style="width: 12px; height: 12px; border-radius: 50%; border: 1px solid white; box-shadow: 0 1px 2px rgba(0,0,0,0.2); background-color: ${color};"></div>`
  });
};

function CreateEventMarker() {
  const [, navigate] = useLocation();
  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [touchCount, setTouchCount] = useState(0);
  const [startPoint, setStartPoint] = useState<{ x: number, y: number } | null>(null);
  const moveThreshold = 10;

  const map = useMapEvents({
    touchstart: (e) => {
      const touches = e.originalEvent.touches;
      setTouchCount(touches.length);

      if (touches.length === 1) {
        const touch = touches[0];
        setStartPoint({ x: touch.clientX, y: touch.clientY });

        const container = map.getContainer();
        const pos = L.point(touch.clientX, touch.clientY);
        const touchLatLng = map.containerPointToLatLng(pos);

        setPressTimer(setTimeout(() => {
          navigate(`/create-event?lat=${touchLatLng.lat}&lng=${touchLatLng.lng}&zoom=18`);
        }, 512));
      }
    },
    touchmove: (e) => {
      if (startPoint && e.originalEvent.touches.length === 1) {
        const touch = e.originalEvent.touches[0];
        const deltaX = Math.abs(touch.clientX - startPoint.x);
        const deltaY = Math.abs(touch.clientY - startPoint.y);

        if (deltaX > moveThreshold || deltaY > moveThreshold) {
          if (pressTimer) {
            clearTimeout(pressTimer);
            setPressTimer(null);
          }
          setStartPoint(null);
        }
      }
    },
    touchend: () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        setPressTimer(null);
      }
      setTouchCount(0);
      setStartPoint(null);
    },
    touchcancel: () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        setPressTimer(null);
      }
      setTouchCount(0);
      setStartPoint(null);
    },
    mousedown: (e) => {
      setStartPoint({ x: e.originalEvent.clientX, y: e.originalEvent.clientY });
      setPressTimer(setTimeout(() => {
        navigate(`/create-event?lat=${e.latlng.lat}&lng=${e.latlng.lng}&zoom=18`);
      }, 512));
    },
    mousemove: (e) => {
      if (startPoint) {
        const deltaX = Math.abs(e.originalEvent.clientX - startPoint.x);
        const deltaY = Math.abs(e.originalEvent.clientY - startPoint.y);

        if (deltaX > moveThreshold || deltaY > moveThreshold) {
          if (pressTimer) {
            clearTimeout(pressTimer);
            setPressTimer(null);
          }
          setStartPoint(null);
        }
      }
    },
    mouseup: () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        setPressTimer(null);
      }
      setStartPoint(null);
    },
    mouseleave: () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        setPressTimer(null);
      }
      setStartPoint(null);
    }
  });

  return null;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    0.5 - Math.cos(dLat) / 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    (1 - Math.cos(dLon)) / 2;

  return R * 2 * Math.asin(Math.sqrt(a));
}

function MapBoundsControl() {
  const map = useMap();

  useEffect(() => {
    const storedBounds = sessionStorage.getItem('mapBounds');
    if (storedBounds) {
      const { events } = JSON.parse(storedBounds);
      if (events && events.length >= 2) {
        const bounds = L.latLngBounds(events.map(e => [e.lat, e.lng]));
        map.flyToBounds(bounds, {
          padding: [50, 50],
          duration: 1.5,
          easeLinearity: 0.5
        });
      }
    }
  }, [map, sessionStorage.getItem('mapBounds')]);

  return null;
}

function UserLocationMarker() {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const map = useMap();

  useEffect(() => {
    map.locate().on("locationfound", function (e) {
      setPosition([e.latitude, e.longitude]);
      map.flyTo([e.latitude, e.longitude], map.getZoom());
    });
  }, [map]);

  if (!position) return null;

  const pulsingIcon = L.divIcon({
    className: 'custom-icon',
    html: `
      <div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white pulse-animation"></div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

  return (
    <Marker position={position} icon={pulsingIcon}>
      <Popup>
        <div className="text-sm font-medium">Mijn locatie</div>
      </Popup>
    </Marker>
  );
}


export default function MapView({ filters, onFilterChange }: MapViewProps) {
  const [userLocation, setUserLocation] = useState<[number, number]>([51.7656, 5.5314]);
  const [isSatelliteView, setIsSatelliteView] = useState(false);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [currentSearch, setCurrentSearch] = useState<string>('');
  const [mapKey, setMapKey] = useState(0);
  const [showFreeOnly, setShowFreeOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    Object.keys(categoryColors).filter(cat => cat !== 'all')
  );
  const [maxDaysToEvent, setMaxDaysToEvent] = useState(14);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [eventCounts, setEventCounts] = useState<Record<string, number>>({});
  const [isTimeFilterVisible, setIsTimeFilterVisible] = useState(false);
  const [isPriceFilterVisible, setIsPriceFilterVisible] = useState(false);
  const [isCategoryLegendVisible, setIsCategoryLegendVisible] = useState(false);
  const quickFiltersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedSearch = sessionStorage.getItem('currentSearch');
    if (storedSearch) {
      setCurrentSearch(storedSearch);
      // Update filters with search query
      if (onFilterChange) {
        onFilterChange({
          ...filters,
          searchQuery: storedSearch
        });
      }
      console.log('Current search updated:', storedSearch);
    }
  }, [sessionStorage.getItem('currentSearch'), onFilterChange]);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
          setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        }
      );
    }
  }, []);

  const { data: events = [] } = useQuery({
    queryKey: ["/api/events/nearby", filters, userLocation],
    queryFn: async () => {
      if (!userLocation) return [];
      const params = new URLSearchParams({
        lat: userLocation[0].toString(),
        lng: userLocation[1].toString(),
        radius: "10",
      });

      const response = await fetch(`/api/events/nearby?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      const data = await response.json();

      // Calculate category counts
      const counts = { 'all': data.length };
      data.forEach((event: Event) => {
        counts[event.category] = (counts[event.category] || 0) + 1;
      });
      setEventCounts(counts);

      return data;
    },
  });

  const getTimeToEvent = (startTime: string) => {
    const days = differenceInDays(new Date(startTime), selectedDate);
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days < 0) return "Past event";
    if (days < 7) return `In ${days} days`;
    if (days < 30) return `In ${Math.floor(days / 7)} weeks`;
    return `In ${Math.floor(days / 30)} months`;
  };

  const filteredEvents = events.filter(event => {
    // Category filter - only show events in selected categories
    if (!selectedCategories.includes(event.category.toLowerCase())) return false;

    // Price filter
    if (showFreeOnly && event.isPaid) return false;
    if (maxPrice !== null && event.price > maxPrice) return false;

    // Time filter - account for selected date and max days
    const eventDate = new Date(event.startTime);
    const daysUntilEvent = differenceInDays(eventDate, selectedDate);
    if (daysUntilEvent < 0) return false; // Past events
    if (maxDaysToEvent !== 999 && daysUntilEvent > maxDaysToEvent) return false;

    // Search filter - prioritize current search from top nav
    const searchTerm = filters.searchQuery || currentSearch;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        event.title.toLowerCase().includes(searchLower) ||
        event.category.toLowerCase().includes(searchLower) ||
        (event.subcategory && event.subcategory.toLowerCase().includes(searchLower)) ||
        (event.description && event.description.toLowerCase().includes(searchLower))
      );
    }

    return true;
  });

  // Calculate active filters for visual indicators
  const activeFilters = [
    selectedCategories.length < Object.keys(categoryColors).length -1 && 'category',
    showFreeOnly && 'price',
    maxDaysToEvent !== 14 && 'time',
    currentSearch && 'search'
  ].filter(Boolean);

  const tileUrl = isSatelliteView
    ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  const tileConfig = isSatelliteView
    ? { subdomains: [] }
    : { subdomains: 'abcd' };

  // Function to update both local and parent state
  const updateFilters = (updates: Partial<typeof filters>) => {
    if (onFilterChange) {
      onFilterChange({
        ...filters,
        ...updates
      });
    }
  };

  // Handle clicking outside quick filters
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (quickFiltersRef.current && !quickFiltersRef.current.contains(event.target as Node)) {
        setIsCategoryLegendVisible(false);
        setIsTimeFilterVisible(false);
        setIsPriceFilterVisible(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

      {/* Quick Filters - Right side */}
      <div ref={quickFiltersRef} className="absolute top-4 right-4 z-[1000] flex flex-col gap-1.5">
        {/* Categories */}
        <Button
          variant="outline"
          size="icon"
          className={`bg-white/90 hover:bg-white h-8 w-8 relative ${
            selectedCategories.length < Object.keys(categoryColors).length - 1 ? 'border-primary border-2 text-primary shadow-md' : ''
          }`}
          onClick={() => setIsCategoryLegendVisible(!isCategoryLegendVisible)}
          title="Categorieën"
        >
          <CategoryIcon className="h-4 w-4" />
          {selectedCategories.length < Object.keys(categoryColors).length - 1 && (
            <Badge variant="secondary" className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center bg-primary text-white">
              •
            </Badge>
          )}
        </Button>

        {/* Free/Paid Toggle */}
        <Button
          variant="outline"
          size="icon"
          className={`bg-white/90 hover:bg-white h-8 w-8 relative ${
            (showFreeOnly || maxPrice !== null) ? 'border-primary border-2 text-primary shadow-md' : ''
          }`}
          onClick={() => setIsPriceFilterVisible(!isPriceFilterVisible)}
          title={showFreeOnly ? 'Alleen Gratis' : maxPrice ? `Max €${maxPrice}` : 'Alle Prijzen'}
        >
          <Euro className="h-4 w-4" />
          {(showFreeOnly || maxPrice !== null) && (
            <Badge variant="secondary" className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center bg-primary text-white">
              •
            </Badge>
          )}
        </Button>

        {/* Time Filter */}
        <Button
          variant="outline"
          size="icon"
          className={`bg-white/90 hover:bg-white h-8 w-8 relative ${
            maxDaysToEvent !== 14 ? 'border-primary border-2 text-primary shadow-md' : ''
          }`}
          onClick={() => setIsTimeFilterVisible(!isTimeFilterVisible)}
          title={maxDaysToEvent === 999 ? 'Alle Events' : `Binnen ${maxDaysToEvent} dagen`}
        >
          <Clock className="h-4 w-4" />
          {maxDaysToEvent !== 14 && (
            <Badge variant="secondary" className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center bg-primary text-white">
              •
            </Badge>
          )}
        </Button>

        {/* Search Results Indicator */}
        {currentSearch && (
          <Button
            variant="outline"
            size="icon"
            className="bg-white/90 hover:bg-white h-8 w-8 border-primary border-2 text-primary shadow-md"
            title={`Zoeken: "${currentSearch}"`}
          >
            <Search className="h-4 w-4" />
            <Badge variant="secondary" className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center bg-primary text-white">
              •
            </Badge>
          </Button>
        )}
      </div>

      {/* Category Legend - Aligned right */}
      {isCategoryLegendVisible && (
        <div className="absolute top-[52px] right-4 z-[1000] bg-white p-2 rounded-lg shadow-md">
          <div className="grid gap-1.5">
            {Object.entries(categoryColors)
              .filter(([cat]) => cat !== 'all')
              .map(([category, color]) => {
                const count = eventCounts[category] || 0;
                const isDisabled = count === 0;
                const isSelected = selectedCategories.includes(category);

                return (
                  <button
                    key={category}
                    onClick={() => {
                      if (!isDisabled) {
                        const newCategories = isSelected
                          ? selectedCategories.filter(c => c !== category)
                          : [...selectedCategories, category];
                        setSelectedCategories(newCategories);
                        updateFilters({ categories: newCategories });
                      }
                    }}
                    className={cn(
                      "flex items-center gap-2 p-1 rounded hover:bg-gray-100",
                      isDisabled ? "opacity-50 cursor-not-allowed" : "",
                      isSelected ? "text-primary" : ""
                    )}
                    disabled={isDisabled}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-xs capitalize">
                      {category} ({count})
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Price Filter Popover */}
      {isPriceFilterVisible && (
        <div className="absolute top-[52px] right-4 z-[1000] bg-white p-2 rounded-lg shadow-md w-[260px]">
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="priceFilter"
                checked={!showFreeOnly && maxPrice === null}
                onChange={() => {
                  setShowFreeOnly(false);
                  setMaxPrice(null);
                  updateFilters({ showFreeOnly: false, maxPrice: null });
                }}
                className="w-4 h-4"
              />
              <span>Alle evenementen</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="priceFilter"
                checked={showFreeOnly}
                onChange={() => {
                  setShowFreeOnly(true);
                  setMaxPrice(null);
                  updateFilters({ showFreeOnly: true, maxPrice: null });
                }}
                className="w-4 h-4"
              />
              <span>Alleen gratis evenementen</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="priceFilter"
                checked={!showFreeOnly && maxPrice !== null}
                onChange={() => {
                  setShowFreeOnly(false);
                  setMaxPrice(50);
                  updateFilters({ showFreeOnly: false, maxPrice: 50 });
                }}
                className="w-4 h-4"
              />
              <span>Maximum prijs</span>
            </label>

            {!showFreeOnly && maxPrice !== null && (
              <div className="space-y-2 mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Max prijs:</span>
                  <span className="text-sm font-medium">€{maxPrice}</span>
                </div>
                <Slider
                  value={[maxPrice || 50]}
                  onValueChange={(values) => {
                    setMaxPrice(values[0]);
                    updateFilters({ maxPrice: values[0] });
                  }}
                  max={200}
                  step={5}
                  min={5}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>€5</span>
                  <span>€200</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Time Filter Popover */}
      {isTimeFilterVisible && (
        <div className="absolute top-[52px] right-4 z-[1000] bg-white p-2 rounded-lg shadow-md w-[260px]">
          <div className="space-y-4">
            {/* Date Selection */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  const now = new Date();
                  setSelectedDate(now);
                  updateFilters({ selectedDate: now.toISOString() });
                }}
              >
                {format(selectedDate, 'PPP', { locale: nl })}
              </Button>
            </div>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (date) {
                  setSelectedDate(date);
                  updateFilters({ selectedDate: date.toISOString() });
                }
              }}
              className="rounded-md border"
            />

            {/* Days Range */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Binnen dagen:</span>
                <span className="text-sm font-medium">
                  {maxDaysToEvent === 999 ? 'Alle' : maxDaysToEvent}
                </span>
              </div>
              <Slider
                value={[maxDaysToEvent === 999 ? 14 : maxDaysToEvent]}
                onValueChange={(values) => {
                  const value = values[0];
                  // If slider is at max, show all events
                  const newValue = value === 14 ? 999 : value;
                  setMaxDaysToEvent(newValue);
                  updateFilters({ maxDaysToEvent: newValue });
                }}
                max={14}
                step={1}
                min={1}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 dag</span>
                <span>2 weken</span>
              </div>
            </div>
          </div>
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
        <CreateEventMarker />
        <MapBoundsControl />
        <UserLocationMarker />

        {/* Event Markers */}
        {filteredEvents.map(event => {
          const lat = Number(event.latitude);
          const lng = Number(event.longitude);

          if (isNaN(lat) || isNaN(lng)) return null;

          const distance = location ?
            calculateDistance(location.lat, location.lng, lat, lng) :
            null;

          const timeToEvent = getTimeToEvent(event.startTime);

          return (
            <Marker
              key={event.id}
              position={[lat, lng]}
              icon={createEventIcon(event.category)}
            >
              <Popup className="event-popup" maxWidth={300}>
                <div className="text-sm pb-1">
                  <div className="event-card-map">
                    <div className="font-semibold mb-1 flex items-center gap-1.5">
                      <div style={{ color: getCategoryColor(event.category) }}>
                        {event.category.charAt(0).toUpperCase() + event.category.slice(1)}
                      </div>
                      <div>{event.title}</div>
                    </div>
                    {event.description && (
                      <div className="mb-2 text-xs">
                        {event.description.substring(0, 80)}
                        {event.description.length > 80 ? '...' : ''}
                      </div>
                    )}
                    <div className="flex justify-between items-center text-xs text-gray-600 mb-1">
                      <span>{distance !== null ? `${distance.toFixed(1)} km` : ''}</span>
                      <span>{timeToEvent}</span>
                    </div>
                    <Link
                      to={`/event/${event.id}`}
                      className="text-blue-600 hover:text-blue-800 underline text-xs"
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
  categories: string[];
  fromDate: Date | null;
  toDate: Date | null;
  showPaidEvents: boolean;
  maxPrice: number | null;
  useDistanceFilter: boolean;
  distanceRadius: number;
  onFilterChange?: (filters: FilterProps) => void;
}

interface MapViewProps {
  filters: FilterProps;
  onFilterChange?: (filters: FilterProps) => void;
}