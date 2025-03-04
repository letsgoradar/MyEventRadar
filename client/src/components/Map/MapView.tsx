import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import { Satellite, ChevronDown, Calendar } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { format, differenceInDays, addDays } from "date-fns";
import { nl } from "date-fns/locale";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import L from 'leaflet';
import React, { useState, useEffect } from 'react';
import type { Event } from "@shared/schema";
import './leaflet-fix.css';
import { useLocation } from "wouter";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";

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
  const color = categoryColors[category.toLowerCase()];
  console.log('Getting color for category:', category, 'Color:', color);
  return color || '#9E9E9E'; // grey as fallback
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


function MapView({ filters }: MapViewProps) {
  const [userLocation, setUserLocation] = useState<[number, number]>([51.7656, 5.5314]);
  const [isSatelliteView, setIsSatelliteView] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [currentSearch, setCurrentSearch] = useState<string>('');
  const [mapKey, setMapKey] = useState(0);
  const [showFreeOnly, setShowFreeOnly] = useState(false);
  const [isCategoryLegendVisible, setIsCategoryLegendVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [maxDaysToEvent, setMaxDaysToEvent] = useState(30); // Default to 30 days
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [eventCounts, setEventCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const storedSearch = sessionStorage.getItem('currentSearch');
    if (storedSearch) {
      setCurrentSearch(storedSearch);
      console.log('Current search updated:', storedSearch);
    }
  }, [sessionStorage.getItem('currentSearch')]); 

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
          setLocation({lat: position.coords.latitude, lng: position.coords.longitude});
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
      const counts = {'all': data.length};
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
    if (days < 30) return `In ${Math.floor(days/7)} weeks`;
    return `In ${Math.floor(days/30)} months`;
  };

  const filteredEvents = events.filter(event => {
    // Category filter
    if (selectedCategory !== 'all' && event.category !== selectedCategory) return false;

    // Paid/free filter
    if (showFreeOnly && event.isPaid) return false;

    // Time filter
    const daysUntilEvent = differenceInDays(new Date(event.startTime), selectedDate);
    if (daysUntilEvent < 0 || daysUntilEvent > maxDaysToEvent) return false;

    // Search filter
    if (currentSearch) {
      const searchLower = currentSearch.toLowerCase();
      return (
        event.title.toLowerCase().includes(searchLower) ||
        event.category.toLowerCase().includes(searchLower) ||
        (event.subcategory && event.subcategory.toLowerCase().includes(searchLower)) ||
        (event.description && event.description.toLowerCase().includes(searchLower))
      );
    }

    return true;
  });

  // Active filters count
  const activeFilterCount = [
    selectedCategory !== 'all',
    showFreeOnly,
    maxDaysToEvent !== 30,
    !!currentSearch
  ].filter(Boolean).length;

  const tileUrl = isSatelliteView
    ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  const tileConfig = isSatelliteView
    ? { subdomains: [] }
    : { subdomains: 'abcd' };

  return (
    <div className="h-full relative">
      {/* Map Controls */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        <Button
          variant="outline"
          size="icon"
          className="bg-white/90 hover:bg-white"
          onClick={() => setIsSatelliteView(!isSatelliteView)}
        >
          <Satellite className={`h-4 w-4 ${isSatelliteView ? 'text-primary' : 'text-muted-foreground'}`} />
        </Button>
      </div>

      {/* Quick Filters */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
        {/* Categories */}
        <Button
          variant="outline"
          className={`bg-white/90 hover:bg-white flex items-center gap-2 ${
            selectedCategory !== 'all' ? 'border-primary text-primary' : ''
          }`}
          onClick={() => setIsCategoryLegendVisible(!isCategoryLegendVisible)}
        >
          Categories
          <Badge variant="secondary" className="ml-2">{selectedCategory === 'all' ? 'All' : selectedCategory}</Badge>
          <ChevronDown className={`h-4 w-4 transition-transform ${isCategoryLegendVisible ? 'rotate-180' : ''}`} />
        </Button>

        {/* Free/Paid Toggle */}
        <Button
          variant="outline"
          className={`bg-white/90 hover:bg-white ${showFreeOnly ? 'border-primary text-primary' : ''}`}
          onClick={() => setShowFreeOnly(!showFreeOnly)}
        >
          {showFreeOnly ? 'Free Events' : 'All Events'}
        </Button>

        {/* Time Filter */}
        <div className="bg-white/90 p-3 rounded-lg border shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[240px]">
                  <Calendar className="mr-2 h-4 w-4" />
                  {format(selectedDate, 'PPP', { locale: nl })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">Within:</span>
            <Slider
              value={[maxDaysToEvent]}
              onValueChange={(values) => setMaxDaysToEvent(values[0])}
              max={90}
              step={1}
              className="w-[150px]"
            />
            <span className="text-sm">{maxDaysToEvent} days</span>
          </div>
        </div>

        {/* Search Results Badge */}
        {currentSearch && (
          <Badge variant="secondary" className="bg-white/90">
            Search: {currentSearch}
          </Badge>
        )}
      </div>

      {/* Category Legend */}
      {isCategoryLegendVisible && (
        <div className="absolute top-[180px] left-4 z-[1000] bg-white p-3 rounded-lg shadow-md">
          <div className="grid gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`flex items-center gap-2 p-1 rounded hover:bg-gray-100 ${
                selectedCategory === 'all' ? 'text-primary' : ''
              }`}
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: categoryColors.all }} />
              <span className="text-xs">All Events ({eventCounts['all'] || 0})</span>
            </button>
            {Object.entries(categoryColors).filter(([cat]) => cat !== 'all').map(([category, color]) => {
              const count = eventCounts[category] || 0;
              const isDisabled = count === 0;
              return (
                <button
                  key={category}
                  onClick={() => !isDisabled && setSelectedCategory(category)}
                  className={`flex items-center gap-2 p-1 rounded hover:bg-gray-100 ${
                    isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                  } ${selectedCategory === category ? 'text-primary' : ''}`}
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

export default MapView;

interface FilterProps {
  searchQuery: string;
  category: string;
  fromDate: Date | null;
  toDate: Date | null;
  showPaidEvents: boolean;
  useDistanceFilter: boolean;
  distanceRadius: number;
}

interface MapViewProps {
  filters: FilterProps;
}